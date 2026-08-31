"""Geocode storage locations via DaData and refresh public product cache."""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.storage_location import StorageLocation
from app.services.dadata_service import geocode_address_sync
from app.utils.public_catalog_cache import invalidate_public_products_for_storage_location

logger = logging.getLogger(__name__)

BATCH_SIZE = 30
BATCH_DELAY_SEC = 0.25


def reset_geocode_fields(location: StorageLocation) -> None:
    location.latitude = None
    location.longitude = None
    location.geocoded_at = None
    location.geocode_qc = None


def apply_geocode_to_location(db: Session, location_id: int) -> bool:
    location = db.query(StorageLocation).filter(StorageLocation.id == location_id).first()
    if not location:
        return False

    address = (location.address or "").strip()
    if not address:
        return False
    if location.latitude is not None and location.longitude is not None:
        return True

    result = geocode_address_sync(address)
    if not result:
        logger.info("Geocode skipped for storage location %s: no coordinates", location_id)
        return False

    location.latitude = result["lat"]
    location.longitude = result["lon"]
    location.geocode_qc = result.get("qc_geo")
    location.geocoded_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    db.refresh(location)
    invalidate_public_products_for_storage_location(db, location_id)
    logger.info("Geocoded storage location %s", location_id)
    return True


def backfill_storage_locations_batch(db: Session, *, limit: int = BATCH_SIZE) -> dict[str, int]:
    rows = (
        db.query(StorageLocation.id)
        .filter(
            StorageLocation.latitude.is_(None),
            StorageLocation.address.isnot(None),
            StorageLocation.address != "",
        )
        .order_by(StorageLocation.id.asc())
        .limit(limit)
        .all()
    )

    processed = 0
    geocoded = 0
    for index, (location_id,) in enumerate(rows):
        processed += 1
        try:
            if apply_geocode_to_location(db, location_id):
                geocoded += 1
        except Exception:
            logger.exception("Geocode failed for storage location %s", location_id)
            db.rollback()
        if index + 1 < len(rows):
            time.sleep(BATCH_DELAY_SEC)

    return {"processed": processed, "geocoded": geocoded}
