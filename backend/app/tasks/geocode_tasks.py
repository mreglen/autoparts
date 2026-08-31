from __future__ import annotations

import logging

from app.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_with_session_sync(sync_fn):
    from app.db.database import SessionLocal

    db = SessionLocal()
    try:
        return sync_fn(db)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=2, name="geocode.storage_location")
def geocode_storage_location_task(self, location_id: int):
    from app.services.geocode_storage_location import apply_geocode_to_location

    try:
        result = _run_with_session_sync(lambda db: apply_geocode_to_location(db, int(location_id)))
        logger.info("Celery geocode finished for storage location %s: %s", location_id, result)
        return {"location_id": int(location_id), "geocoded": bool(result)}
    except Exception as exc:
        logger.exception("Celery geocode failed for storage location %s", location_id)
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(bind=True, max_retries=1, name="geocode.storage_locations_backfill")
def backfill_storage_locations_geocode_task(self, batch_size: int = 30):
    from app.services.geocode_storage_location import backfill_storage_locations_batch

    try:
        result = _run_with_session_sync(
            lambda db: backfill_storage_locations_batch(db, limit=int(batch_size))
        )
        logger.info("Celery storage location geocode backfill finished: %s", result)
        return result
    except Exception as exc:
        logger.exception("Celery storage location geocode backfill failed")
        raise self.retry(exc=exc, countdown=120)
