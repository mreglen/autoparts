from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.laximo_oem_fitment import (
    LaximoApplicableVehicle,
    LaximoOemArticle,
    LaximoOemCatalogScan,
    LaximoOemVehicleLink,
)
from app.utils.partnumber import normalize_partnumber

logger = logging.getLogger(__name__)

STATUS_PENDING = "pending"
STATUS_PARTIAL = "partial"
STATUS_READY = "ready"
STATUS_NOT_FOUND = "not_found"
STATUS_ERROR = "error"

FAV_PENDING = "pending"
FAV_DONE = "done"
FAV_SKIPPED = "skipped"
FAV_ERROR = "error"

READY_TTL_DAYS = 90
NOT_FOUND_RETRY_DAYS = 7
ERROR_RETRY_HOURS = 1


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def vehicle_key_for_row(catalog: str, vehicle_id: Optional[str], brand: str, name: str) -> str:
    vid = (vehicle_id or "").strip()
    if vid:
        return f"{catalog}|{vid}"
    return f"{catalog}|{brand.casefold()}|{name.casefold()}"


def get_or_create_article(
    db: Session,
    *,
    oem_raw: str,
    brand_hint: Optional[str] = None,
) -> LaximoOemArticle:
    oem_norm = normalize_partnumber(oem_raw) or oem_raw.strip().casefold()
    row = db.query(LaximoOemArticle).filter(LaximoOemArticle.oem_norm == oem_norm).first()
    hint = (brand_hint or "").strip()
    if row is None:
        row = LaximoOemArticle(
            oem_norm=oem_norm,
            oem_raw=oem_raw.strip(),
            brand_hint=hint,
            status=STATUS_PENDING,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    elif hint and not row.brand_hint:
        row.brand_hint = hint
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def article_is_fresh(row: LaximoOemArticle) -> bool:
    if row.status not in (STATUS_READY, STATUS_NOT_FOUND):
        return False
    if row.expires_at is None:
        return True
    return _as_utc(row.expires_at) > _utcnow()


def article_retry_blocked(row: LaximoOemArticle) -> bool:
    if row.next_retry_at is None:
        return False
    return _as_utc(row.next_retry_at) > _utcnow()


def should_refresh(row: LaximoOemArticle) -> bool:
    if row.status == STATUS_PENDING:
        return True
    if row.status == STATUS_PARTIAL:
        return True
    if row.status == STATUS_ERROR and not article_retry_blocked(row):
        return True
    if row.status == STATUS_READY and row.expires_at and _as_utc(row.expires_at) <= _utcnow():
        return True
    if row.status == STATUS_NOT_FOUND and not article_retry_blocked(row):
        return True
    return False


def load_vehicles_for_article(db: Session, article_id: int) -> list[dict[str, Any]]:
    rows = (
        db.query(LaximoApplicableVehicle)
        .join(LaximoOemVehicleLink, LaximoOemVehicleLink.vehicle_id == LaximoApplicableVehicle.id)
        .filter(LaximoOemVehicleLink.article_id == article_id)
        .order_by(
            LaximoApplicableVehicle.brand.asc(),
            LaximoApplicableVehicle.name.asc(),
            LaximoApplicableVehicle.year_from.asc(),
        )
        .all()
    )
    out: list[dict[str, Any]] = []
    for row in rows:
        attrs = None
        if row.attributes_json:
            try:
                attrs = json.loads(row.attributes_json)
            except (TypeError, ValueError):
                attrs = None
        out.append(
            {
                "brand": row.brand,
                "name": row.name,
                "catalog": row.catalog,
                "vehicle_id": row.vehicle_id,
                "year_from": row.year_from,
                "year_to": row.year_to,
                "attributes": attrs,
            }
        )
    return out


def upsert_vehicle_and_link(
    db: Session,
    *,
    article: LaximoOemArticle,
    normalized: dict[str, Any],
) -> bool:
    catalog = (normalized.get("catalog") or "").strip()
    brand_text = (normalized.get("brand") or "").strip()
    name_text = (normalized.get("name") or "").strip()
    if not catalog or (not brand_text and not name_text):
        return False

    vehicle_id = normalized.get("vehicle_id")
    vid_str = None if vehicle_id is None else str(vehicle_id).strip() or None
    vkey = vehicle_key_for_row(catalog, vid_str, brand_text, name_text)

    vehicle = (
        db.query(LaximoApplicableVehicle)
        .filter(
            LaximoApplicableVehicle.catalog == catalog,
            LaximoApplicableVehicle.vehicle_key == vkey,
        )
        .first()
    )
    attrs = normalized.get("attributes")
    attrs_json = json.dumps(attrs, ensure_ascii=False) if attrs else None

    if vehicle is None:
        vehicle = LaximoApplicableVehicle(
            catalog=catalog,
            vehicle_id=vid_str,
            vehicle_key=vkey,
            brand=brand_text or None,
            name=name_text or None,
            year_from=normalized.get("year_from"),
            year_to=normalized.get("year_to"),
            attributes_json=attrs_json,
        )
        db.add(vehicle)
        db.flush()
    else:
        if brand_text:
            vehicle.brand = brand_text
        if name_text:
            vehicle.name = name_text
        if normalized.get("year_from"):
            vehicle.year_from = normalized.get("year_from")
        if normalized.get("year_to"):
            vehicle.year_to = normalized.get("year_to")
        if attrs_json:
            vehicle.attributes_json = attrs_json
        db.add(vehicle)

    link = (
        db.query(LaximoOemVehicleLink)
        .filter(
            LaximoOemVehicleLink.article_id == article.id,
            LaximoOemVehicleLink.vehicle_id == vehicle.id,
        )
        .first()
    )
    if link is None:
        db.add(LaximoOemVehicleLink(article_id=article.id, vehicle_id=vehicle.id))
        return True
    return False


def count_article_vehicles(db: Session, article_id: int) -> int:
    return (
        db.query(LaximoOemVehicleLink)
        .filter(LaximoOemVehicleLink.article_id == article_id)
        .count()
    )


def get_or_create_catalog_scan(
    db: Session,
    *,
    article: LaximoOemArticle,
    catalog_code: str,
    catalog_brand: Optional[str] = None,
) -> LaximoOemCatalogScan:
    row = (
        db.query(LaximoOemCatalogScan)
        .filter(
            LaximoOemCatalogScan.article_id == article.id,
            LaximoOemCatalogScan.catalog_code == catalog_code,
        )
        .first()
    )
    if row is None:
        row = LaximoOemCatalogScan(
            article_id=article.id,
            catalog_code=catalog_code,
            catalog_brand=(catalog_brand or "").strip() or None,
            fav_status=FAV_PENDING,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def list_catalog_scans(db: Session, article_id: int) -> list[LaximoOemCatalogScan]:
    return (
        db.query(LaximoOemCatalogScan)
        .filter(LaximoOemCatalogScan.article_id == article_id)
        .order_by(LaximoOemCatalogScan.id.asc())
        .all()
    )


def mark_article_status(
    db: Session,
    article: LaximoOemArticle,
    *,
    status: str,
    last_error: Optional[str] = None,
) -> None:
    now = _utcnow()
    article.status = status
    article.fetched_at = now
    article.last_error = (last_error or "")[:2000] or None
    article.vehicle_count = count_article_vehicles(db, article.id)

    if status == STATUS_READY:
        article.expires_at = now + timedelta(days=READY_TTL_DAYS)
        article.next_retry_at = None
    elif status == STATUS_NOT_FOUND:
        article.expires_at = now + timedelta(days=NOT_FOUND_RETRY_DAYS)
        article.next_retry_at = now + timedelta(days=NOT_FOUND_RETRY_DAYS)
    elif status == STATUS_ERROR:
        article.next_retry_at = now + timedelta(hours=ERROR_RETRY_HOURS)
    elif status == STATUS_PARTIAL:
        article.next_retry_at = now + timedelta(hours=ERROR_RETRY_HOURS)

    db.add(article)
    db.commit()
    db.refresh(article)


def replace_catalog_scans(
    db: Session,
    article: LaximoOemArticle,
    catalogs: list[dict[str, Any]],
) -> list[LaximoOemCatalogScan]:
    existing = {s.catalog_code: s for s in list_catalog_scans(db, article.id)}
    ordered: list[LaximoOemCatalogScan] = []
    for cat in catalogs:
        code = (cat.get("code") or "").strip()
        if not code:
            continue
        brand = (cat.get("brand") or cat.get("name") or "").strip() or None
        if code in existing:
            scan = existing[code]
            if brand and not scan.catalog_brand:
                scan.catalog_brand = brand
                db.add(scan)
        else:
            scan = LaximoOemCatalogScan(
                article_id=article.id,
                catalog_code=code,
                catalog_brand=brand,
                fav_status=FAV_PENDING,
            )
            db.add(scan)
        ordered.append(scan)
    db.commit()
    for scan in ordered:
        db.refresh(scan)
    return ordered


def pick_next_pending_scan(
    scans: list[LaximoOemCatalogScan],
    *,
    brand_hint: Optional[str],
    has_detailapplicability_fn,
    db: Session,
) -> Optional[LaximoOemCatalogScan]:
    brand_norm = (brand_hint or "").strip().casefold()
    pending = [s for s in scans if s.fav_status == FAV_PENDING]

    def sort_key(scan: LaximoOemCatalogScan) -> tuple[int, str]:
        cat_brand = (scan.catalog_brand or "").casefold()
        preferred = 0
        if brand_norm and cat_brand and (brand_norm in cat_brand or cat_brand in brand_norm):
            preferred = 0
        else:
            preferred = 1
        applicable = 0 if has_detailapplicability_fn(db, scan.catalog_code) else 2
        return (preferred, applicable, scan.catalog_code)

    pending.sort(key=sort_key)
    for scan in pending:
        if not has_detailapplicability_fn(db, scan.catalog_code):
            scan.has_detailapplicability = False
            scan.fav_status = FAV_SKIPPED
            scan.scanned_at = _utcnow()
            db.add(scan)
            db.commit()
            continue
        scan.has_detailapplicability = True
        db.add(scan)
        db.commit()
        return scan
    return None


def all_scans_complete(scans: list[LaximoOemCatalogScan]) -> bool:
    if not scans:
        return True
    return all(s.fav_status in (FAV_DONE, FAV_SKIPPED, FAV_ERROR) for s in scans)
