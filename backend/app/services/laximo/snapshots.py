from __future__ import annotations

import hashlib
import logging
import mimetypes
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from sqlalchemy.orm import Session

from app.models.laximo_snapshot import LaximoSnapshot, LaximoSnapshotAsset
from app.models.site_laximo_cat_integration import SiteLaximoCatIntegration
from app.utils.laximo_cat_integration_db import get_or_create_laximo_cat_integration

logger = logging.getLogger(__name__)

PAYLOAD_VERSION = 1

KIND_VIN_LOOKUP = "vin_lookup"
KIND_CATEGORIES = "categories"
KIND_UNITS = "units"
KIND_UNIT_DETAILS = "unit_details"
KIND_IMAGE_MAP = "image_map"
KIND_QUICK_GROUPS = "quick_groups"
KIND_QUICK_GROUP_DETAILS = "quick_group_details"
KIND_CATALOG_FEATURES = "catalog_features"

ASSET_DIR = Path("uploads") / "laximo"
IMAGE_DOWNLOAD_TIMEOUT_SEC = 8


def _norm_part(value: Optional[str]) -> str:
    return (value or "").strip()


def make_vin_key(vin: str) -> str:
    return f"vin:{_norm_part(vin).upper()}"


def make_categories_key(catalog: str, vehicle_id: str, category_id: str) -> str:
    return f"categories:{_norm_part(catalog)}:{_norm_part(vehicle_id)}:{_norm_part(category_id) or '-1'}"


def make_units_key(catalog: str, vehicle_id: str, category_id: str) -> str:
    return f"units:{_norm_part(catalog)}:{_norm_part(vehicle_id)}:{_norm_part(category_id)}"


def make_unit_details_key(catalog: str, vehicle_id: str, unit_id: str) -> str:
    return f"unit:{_norm_part(catalog)}:{_norm_part(vehicle_id)}:{_norm_part(unit_id)}"


def make_image_map_key(catalog: str, vehicle_id: str, unit_id: str) -> str:
    return f"imap:{_norm_part(catalog)}:{_norm_part(vehicle_id)}:{_norm_part(unit_id)}"


def make_quick_groups_key(catalog: str, vehicle_id: str) -> str:
    return f"qg:{_norm_part(catalog)}:{_norm_part(vehicle_id)}"


def make_quick_group_details_key(catalog: str, vehicle_id: str, quick_group_id: str) -> str:
    return f"qgd:{_norm_part(catalog)}:{_norm_part(vehicle_id)}:{_norm_part(quick_group_id)}"


def make_catalog_features_key(catalog: str) -> str:
    return f"features:{_norm_part(catalog)}"


def snapshots_fallback_enabled(db: Session, row: Optional[SiteLaximoCatIntegration] = None) -> bool:
    integration = row or get_or_create_laximo_cat_integration(db)
    return bool(getattr(integration, "snapshots_fallback_enabled", True))


def get_snapshot(
    db: Session,
    kind: str,
    resource_key: str,
) -> Optional[LaximoSnapshot]:
    return (
        db.query(LaximoSnapshot)
        .filter(LaximoSnapshot.kind == kind, LaximoSnapshot.resource_key == resource_key)
        .one_or_none()
    )


def get_snapshot_payload(
    db: Session,
    kind: str,
    resource_key: str,
) -> Optional[tuple[dict[str, Any], Optional[datetime]]]:
    row = get_snapshot(db, kind, resource_key)
    if not row or not isinstance(row.payload, dict):
        return None
    return dict(row.payload), row.fetched_at


def upsert_snapshot(
    db: Session,
    *,
    kind: str,
    resource_key: str,
    payload: dict[str, Any],
    catalog: Optional[str] = None,
    vehicle_id: Optional[str] = None,
    vin: Optional[str] = None,
    materialize_images: bool = False,
    commit: bool = True,
) -> LaximoSnapshot:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    stored_payload = dict(payload)
    if materialize_images:
        stored_payload = materialize_image_urls_in_payload(db, stored_payload, commit=False)

    row = get_snapshot(db, kind, resource_key)
    if row is None:
        row = LaximoSnapshot(
            kind=kind,
            resource_key=resource_key,
            payload=stored_payload,
            payload_version=PAYLOAD_VERSION,
            source="live",
            fetched_at=now,
        )
        db.add(row)
    else:
        row.payload = stored_payload
        row.payload_version = PAYLOAD_VERSION
        row.source = "live"
        row.fetched_at = now

    row.catalog = _norm_part(catalog) or None
    row.vehicle_id = _norm_part(vehicle_id) or None
    row.vin = _norm_part(vin).upper() or None
    row.updated_at = now

    if commit:
        try:
            db.commit()
            db.refresh(row)
        except Exception:
            db.rollback()
            logger.exception("Failed to upsert laximo snapshot kind=%s key=%s", kind, resource_key)
            raise
    else:
        db.flush()
    return row


def try_load_snapshot_envelope_fields(
    db: Session,
    kind: str,
    resource_key: str,
) -> Optional[tuple[dict[str, Any], Optional[datetime]]]:
    if not snapshots_fallback_enabled(db):
        return None
    return get_snapshot_payload(db, kind, resource_key)


def snapshot_counts(db: Session) -> dict[str, int]:
    total = db.query(LaximoSnapshot).count()
    vin_count = (
        db.query(LaximoSnapshot).filter(LaximoSnapshot.kind == KIND_VIN_LOOKUP).count()
    )
    unit_kinds = (
        KIND_CATEGORIES,
        KIND_UNITS,
        KIND_UNIT_DETAILS,
        KIND_IMAGE_MAP,
        KIND_QUICK_GROUPS,
        KIND_QUICK_GROUP_DETAILS,
        KIND_CATALOG_FEATURES,
    )
    node_count = (
        db.query(LaximoSnapshot).filter(LaximoSnapshot.kind.in_(unit_kinds)).count()
    )
    assets = db.query(LaximoSnapshotAsset).count()
    return {
        "snapshots_total": int(total),
        "snapshots_vin": int(vin_count),
        "snapshots_nodes": int(node_count),
        "snapshot_assets": int(assets),
    }


def _normalize_source_url(url: str) -> str:
    text = (url or "").strip()
    if not text:
        return ""
    # Laximo often uses %size% placeholder — pin a concrete size for storage.
    if "%size%" in text:
        text = text.replace("%size%", "source")
    return text


def _url_hash(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()


def _guess_extension(url: str, content_type: Optional[str]) -> str:
    if content_type:
        ext = mimetypes.guess_extension(content_type.split(";")[0].strip())
        if ext:
            return ext
    path = urlparse(url).path
    suffix = Path(path).suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}:
        return suffix
    return ".jpg"


def public_asset_url(local_path: str) -> str:
    p = local_path.replace("\\", "/")
    if not p.startswith("/"):
        p = f"/{p}"
    return p


def get_or_download_asset(
    db: Session,
    source_url: str,
    *,
    commit: bool = True,
) -> Optional[str]:
    """Download image to uploads/laximo and return public /uploads/... URL."""
    url = _normalize_source_url(source_url)
    if not url or not (url.startswith("http://") or url.startswith("https://")):
        return None

    digest = _url_hash(url)
    existing = (
        db.query(LaximoSnapshotAsset)
        .filter(LaximoSnapshotAsset.url_hash == digest)
        .one_or_none()
    )
    if existing and existing.local_path:
        path = Path(existing.local_path)
        if path.is_file():
            return public_asset_url(existing.local_path)

    try:
        req = Request(url, headers={"User-Agent": "autoparts-laximo-snapshot/1.0"})
        with urlopen(req, timeout=IMAGE_DOWNLOAD_TIMEOUT_SEC) as resp:
            data = resp.read()
            content_type = resp.headers.get("Content-Type")
    except Exception:
        logger.info("Failed to download Laximo asset url=%s", url[:120], exc_info=True)
        return None

    if not data:
        return None

    ext = _guess_extension(url, content_type)
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    rel = ASSET_DIR / f"{digest}{ext}"
    try:
        rel.write_bytes(data)
    except Exception:
        logger.exception("Failed to write Laximo asset file")
        return None

    local_path = str(rel).replace("\\", "/")
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if existing is None:
        existing = LaximoSnapshotAsset(
            url_hash=digest,
            source_url=url,
            local_path=local_path,
            content_type=content_type,
            bytes=len(data),
            fetched_at=now,
        )
        db.add(existing)
    else:
        existing.source_url = url
        existing.local_path = local_path
        existing.content_type = content_type
        existing.bytes = len(data)
        existing.fetched_at = now

    if commit:
        try:
            db.commit()
        except Exception:
            db.rollback()
            logger.exception("Failed to commit Laximo snapshot asset")
            return public_asset_url(local_path)
    else:
        db.flush()
    return public_asset_url(local_path)


def _rewrite_image_fields(db: Session, obj: Any, commit: bool) -> Any:
    if isinstance(obj, dict):
        out = {}
        for key, value in obj.items():
            if key == "image_url" and isinstance(value, str) and value.strip():
                local = get_or_download_asset(db, value, commit=commit)
                out[key] = local or value
                if local:
                    out["image_local_url"] = local
                    out["image_source_url"] = _normalize_source_url(value)
            else:
                out[key] = _rewrite_image_fields(db, value, commit)
        return out
    if isinstance(obj, list):
        return [_rewrite_image_fields(db, item, commit) for item in obj]
    return obj


def materialize_image_urls_in_payload(
    db: Session,
    payload: dict[str, Any],
    *,
    commit: bool = False,
) -> dict[str, Any]:
    return _rewrite_image_fields(db, payload, commit)


def format_fetched_at(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value.isoformat(sep=" ", timespec="seconds") + "Z"
