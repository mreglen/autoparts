from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.services.laximo import cat_client
from app.services.laximo.catalog_features import has_detailapplicability
from app.services.laximo.cat_client import LaximoCatError, LaximoProductCardQuotaExhausted
from app.services.laximo.gate import (
    PUBLIC_NOT_FOUND,
    PUBLIC_OK,
    PUBLIC_TEMPORARILY_UNAVAILABLE,
    assert_public_message_safe,
    laximo_cat_ready,
    public_message_for_reason,
)
from app.services.laximo.oem_applicability_store import (
    FAV_DONE,
    FAV_ERROR,
    STATUS_ERROR,
    STATUS_NOT_FOUND,
    STATUS_PARTIAL,
    STATUS_READY,
    all_scans_complete,
    article_is_fresh,
    article_retry_blocked,
    get_or_create_article,
    list_catalog_scans,
    load_vehicles_for_article,
    mark_article_status,
    pick_next_pending_scan,
    replace_catalog_scans,
    should_refresh,
    upsert_vehicle_and_link,
)
from app.services.laximo.unit_tree import SoftEnvelope
from app.utils.partnumber import normalize_partnumber

logger = logging.getLogger(__name__)

CACHE_TTL_SEC = 3600
VEHICLE_CAP = 24
MAX_UPSTREAM_PER_VIEW = 3
QUOTA_KIND_PRODUCT_CARD = "product_card"

_applicable_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_on_vehicle_cache: dict[str, tuple[float, dict[str, Any]]] = {}


def clear_oem_applicability_cache() -> None:
    _applicable_cache.clear()
    _on_vehicle_cache.clear()


def _unavailable() -> SoftEnvelope:
    _, message = public_message_for_reason(PUBLIC_TEMPORARILY_UNAVAILABLE)
    assert_public_message_safe(message)
    return SoftEnvelope(
        ok=False,
        reason=PUBLIC_TEMPORARILY_UNAVAILABLE,
        message=message,
    )


def _not_found(message: Optional[str] = None) -> SoftEnvelope:
    title, default_message = public_message_for_reason(PUBLIC_NOT_FOUND)
    text = message or default_message
    assert_public_message_safe(text)
    return SoftEnvelope(
        ok=False,
        reason=PUBLIC_NOT_FOUND,
        message=text,
    )


def _ok(**payload: Any) -> SoftEnvelope:
    return SoftEnvelope(ok=True, reason=PUBLIC_OK, message=None, payload=dict(payload))


def _cache_get(store: dict[str, tuple[float, dict[str, Any]]], key: str) -> Optional[dict[str, Any]]:
    entry = store.get(key)
    if not entry:
        return None
    expires_at, value = entry
    if time.monotonic() >= expires_at:
        store.pop(key, None)
        return None
    return value


def _cache_set(
    store: dict[str, tuple[float, dict[str, Any]]],
    key: str,
    value: dict[str, Any],
) -> None:
    store[key] = (time.monotonic() + CACHE_TTL_SEC, value)


def _attr_value(attributes: list[dict[str, Any]], *keys: str) -> Optional[str]:
    wanted = {k.lower() for k in keys}
    for item in attributes:
        key = str(item.get("key") or item.get("name") or "").strip().lower()
        if key not in wanted:
            continue
        val = item.get("value")
        if val is None:
            continue
        text = str(val).strip()
        if text:
            return text
    return None


def _normalize_vehicle_row(row: dict[str, Any]) -> dict[str, Any]:
    attributes = row.get("attributes") if isinstance(row.get("attributes"), list) else []
    year_from = _attr_value(attributes, "modelyearfrom", "datefrom", "manufactured")
    year_to = _attr_value(attributes, "modelyearto", "dateto")
    vehicle_id = row.get("vehicle_id")
    if vehicle_id is None:
        vehicle_id = row.get("vehicleId") or row.get("vehicleid")
    return {
        "brand": row.get("brand"),
        "name": row.get("name"),
        "catalog": row.get("catalog"),
        "vehicle_id": None if vehicle_id is None else str(vehicle_id).strip() or None,
        "year_from": year_from,
        "year_to": year_to,
        "attributes": attributes or None,
    }


def _dedupe_response_rows(vehicles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for row in vehicles:
        brand_text = (row.get("brand") or "").strip()
        name_text = (row.get("name") or "").strip()
        if not brand_text and not name_text:
            continue
        dedupe = "|".join(
            [
                brand_text.casefold(),
                name_text.casefold(),
                str(row.get("year_from") or ""),
                str(row.get("year_to") or ""),
                str(row.get("vehicle_id") or ""),
            ]
        )
        if dedupe in seen:
            continue
        seen.add(dedupe)
        out.append(row)
        if len(out) >= VEHICLE_CAP:
            break
    return out


def _build_payload(
    *,
    oem_raw: str,
    vehicles: list[dict[str, Any]],
    article_status: str,
    data_source: str,
    coverage: str,
    total: int,
    updated_at: Optional[str] = None,
) -> dict[str, Any]:
    capped = _dedupe_response_rows(vehicles)
    return {
        "oem": oem_raw,
        "vehicles": capped,
        "fitment_status": article_status,
        "data_source": data_source,
        "coverage": coverage,
        "total": min(total, len(capped)) if total else len(capped),
        "updated_at": updated_at,
    }


def _payload_from_article(db: Session, article, *, data_source: str, coverage: str) -> dict[str, Any]:
    vehicles = load_vehicles_for_article(db, article.id)
    updated_at = article.fetched_at.isoformat() if article.fetched_at else None
    return _build_payload(
        oem_raw=article.oem_raw,
        vehicles=vehicles,
        article_status=article.status,
        data_source=data_source,
        coverage=coverage,
        total=article.vehicle_count or len(vehicles),
        updated_at=updated_at,
    )


def _incremental_fetch(
    db: Session,
    article,
    *,
    oem_raw: str,
    brand: Optional[str],
    max_calls: int,
) -> tuple[int, bool]:
    """Returns (calls_used, quota_exhausted)."""
    calls = 0
    quota_hit = False
    scans = list_catalog_scans(db, article.id)

    needs_fpr = len(scans) == 0
    if needs_fpr and calls < max_calls:
        if not laximo_cat_ready(db):
            return calls, quota_hit
        try:
            catalogs = cat_client.find_part_references(
                db,
                oem=oem_raw,
                count_toward_quota=True,
                quota_kind=QUOTA_KIND_PRODUCT_CARD,
            )
            calls += 1
        except LaximoProductCardQuotaExhausted:
            return calls, True
        except LaximoCatError as exc:
            logger.exception("FindPartReferences failed")
            mark_article_status(db, article, status=STATUS_ERROR, last_error=str(exc))
            return calls, quota_hit
        except Exception:
            logger.exception("Unexpected FindPartReferences error")
            mark_article_status(db, article, status=STATUS_ERROR, last_error="unexpected")
            return calls, quota_hit

        if not catalogs:
            mark_article_status(db, article, status=STATUS_NOT_FOUND)
            return calls, quota_hit

        scans = replace_catalog_scans(db, article, catalogs)

    while calls < max_calls:
        scan = pick_next_pending_scan(
            scans,
            brand_hint=brand,
            has_detailapplicability_fn=has_detailapplicability,
            db=db,
        )
        if scan is None:
            break
        if not laximo_cat_ready(db):
            break
        try:
            rows = cat_client.find_applicable_vehicles(
                db,
                catalog=scan.catalog_code,
                oem=oem_raw,
                count_toward_quota=True,
                quota_kind=QUOTA_KIND_PRODUCT_CARD,
            )
            calls += 1
            found = 0
            for row in rows:
                normalized = _normalize_vehicle_row(
                    {
                        **row,
                        "catalog": scan.catalog_code,
                        "brand": row.get("brand") or scan.catalog_brand,
                    }
                )
                if upsert_vehicle_and_link(db, article=article, normalized=normalized):
                    found += 1
            scan.fav_status = FAV_DONE
            scan.vehicles_found = len(rows)
            scan.scanned_at = datetime.now(timezone.utc)
            db.add(scan)
            db.commit()
        except LaximoProductCardQuotaExhausted:
            quota_hit = True
            break
        except LaximoCatError as exc:
            logger.exception("FindApplicableVehicles failed for %s", scan.catalog_code)
            scan.fav_status = FAV_ERROR
            db.add(scan)
            db.commit()
            mark_article_status(db, article, status=STATUS_PARTIAL, last_error=str(exc))
            break
        except Exception:
            logger.exception("Unexpected FindApplicableVehicles error for %s", scan.catalog_code)
            scan.fav_status = FAV_ERROR
            db.add(scan)
            db.commit()
            mark_article_status(db, article, status=STATUS_PARTIAL, last_error="unexpected")
            break

        scans = list_catalog_scans(db, article.id)

    scans = list_catalog_scans(db, article.id)
    vehicle_count = len(load_vehicles_for_article(db, article.id))
    if vehicle_count == 0 and all_scans_complete(scans) and article.status != STATUS_NOT_FOUND:
        mark_article_status(db, article, status=STATUS_NOT_FOUND)
    elif all_scans_complete(scans) and vehicle_count > 0:
        mark_article_status(db, article, status=STATUS_READY)
    elif vehicle_count > 0:
        mark_article_status(db, article, status=STATUS_PARTIAL)

    db.refresh(article)
    return calls, quota_hit


def lookup_applicable_vehicles(
    db: Session,
    *,
    oem: str,
    brand: Optional[str] = None,
) -> SoftEnvelope:
    """DB-first FindPartReferences → FindApplicableVehicles with persisted many-to-many fitment."""
    oem_raw = (oem or "").strip()
    if not oem_raw:
        return SoftEnvelope(
            ok=False,
            reason=PUBLIC_TEMPORARILY_UNAVAILABLE,
            message="Укажите артикул детали",
        )

    oem_norm = normalize_partnumber(oem_raw) or oem_raw.casefold()
    brand_norm = (brand or "").strip().casefold()
    cache_key = f"fav:{oem_norm}:{brand_norm}"
    cached = _cache_get(_applicable_cache, cache_key)
    if cached is not None:
        return _ok(**cached)

    article = get_or_create_article(db, oem_raw=oem_raw, brand_hint=brand)

    if article_is_fresh(article):
        if article.status == STATUS_NOT_FOUND:
            payload = _build_payload(
                oem_raw=oem_raw,
                vehicles=[],
                article_status=STATUS_NOT_FOUND,
                data_source="db",
                coverage="none",
                total=0,
                updated_at=article.fetched_at.isoformat() if article.fetched_at else None,
            )
            _cache_set(_applicable_cache, cache_key, payload)
            return _not_found()
        payload = _payload_from_article(db, article, data_source="db", coverage="full")
        _cache_set(_applicable_cache, cache_key, payload)
        return _ok(**payload)

    if article_retry_blocked(article) and article.status in (STATUS_NOT_FOUND, STATUS_ERROR):
        if article.vehicle_count > 0:
            payload = _payload_from_article(db, article, data_source="db", coverage="partial")
            _cache_set(_applicable_cache, cache_key, payload)
            return _ok(**payload)
        if article.status == STATUS_NOT_FOUND:
            return _not_found()

    existing_vehicles = load_vehicles_for_article(db, article.id)
    data_source = "db" if existing_vehicles else "none"
    coverage = "partial" if existing_vehicles else "none"

    if should_refresh(article) and laximo_cat_ready(db):
        _, quota_hit = _incremental_fetch(
            db,
            article,
            oem_raw=oem_raw,
            brand=brand,
            max_calls=MAX_UPSTREAM_PER_VIEW,
        )
        db.refresh(article)
        existing_vehicles = load_vehicles_for_article(db, article.id)
        if existing_vehicles:
            data_source = "mixed" if quota_hit or article.status == STATUS_PARTIAL else "laximo"
            coverage = "partial" if article.status == STATUS_PARTIAL or quota_hit else "full"
        elif quota_hit:
            return _unavailable()
    elif not laximo_cat_ready(db) and not existing_vehicles:
        return _unavailable()

    if article.status == STATUS_NOT_FOUND and not existing_vehicles:
        payload = _build_payload(
            oem_raw=oem_raw,
            vehicles=[],
            article_status=STATUS_NOT_FOUND,
            data_source="db",
            coverage="none",
            total=0,
            updated_at=article.fetched_at.isoformat() if article.fetched_at else None,
        )
        _cache_set(_applicable_cache, cache_key, payload)
        return _not_found()

    if not existing_vehicles:
        payload = _build_payload(
            oem_raw=oem_raw,
            vehicles=[],
            article_status=article.status,
            data_source=data_source,
            coverage="none",
            total=0,
            updated_at=article.fetched_at.isoformat() if article.fetched_at else None,
        )
        _cache_set(_applicable_cache, cache_key, payload)
        if article.status == STATUS_ERROR:
            return _unavailable()
        return _not_found()

    payload = _build_payload(
        oem_raw=oem_raw,
        vehicles=existing_vehicles,
        article_status=article.status,
        data_source=data_source,
        coverage=coverage,
        total=article.vehicle_count or len(existing_vehicles),
        updated_at=article.fetched_at.isoformat() if article.fetched_at else None,
    )
    _cache_set(_applicable_cache, cache_key, payload)
    return _ok(**payload)


def lookup_oem_on_vehicle(
    db: Session,
    *,
    catalog: str,
    ssd: str,
    oem: str,
) -> SoftEnvelope:
    """GetOEMPartApplicability for a specific vehicle context."""
    if not laximo_cat_ready(db):
        return _unavailable()

    cat = (catalog or "").strip()
    ssd_text = (ssd or "").strip()
    oem_raw = (oem or "").strip()
    if not cat or not ssd_text or not oem_raw:
        return SoftEnvelope(
            ok=False,
            reason=PUBLIC_TEMPORARILY_UNAVAILABLE,
            message="Недостаточно данных для проверки применимости",
        )

    oem_norm = normalize_partnumber(oem_raw) or oem_raw.casefold()
    cache_key = f"goa:{cat}:{oem_norm}:{hash(ssd_text)}"
    cached = _cache_get(_on_vehicle_cache, cache_key)
    if cached is not None:
        return _ok(**cached)

    try:
        if not has_detailapplicability(db, cat):
            payload = {
                "oem": oem_raw,
                "applicability": "NONAPPLICABLE",
                "units": [],
            }
            return _ok(**payload)
    except LaximoCatError:
        logger.exception("Failed to read detailapplicability for %s", cat)
        return _unavailable()
    except Exception:
        logger.exception("Unexpected features error for applicability")
        return _unavailable()

    try:
        raw = cat_client.get_oem_part_applicability(
            db,
            catalog=cat,
            ssd=ssd_text,
            oem=oem_raw,
            count_toward_quota=True,
        )
    except LaximoCatError:
        logger.exception("GetOEMPartApplicability failed")
        return _unavailable()
    except Exception:
        logger.exception("Unexpected GetOEMPartApplicability error")
        return _unavailable()

    units = []
    for unit in raw.get("units") or []:
        if not isinstance(unit, dict):
            continue
        units.append(
            {
                "unit_id": unit.get("unit_id"),
                "code": unit.get("code"),
                "name": unit.get("name"),
            }
        )
        if len(units) >= VEHICLE_CAP:
            break

    payload = {
        "oem": oem_raw,
        "applicability": raw.get("applicability") or "NONAPPLICABLE",
        "units": units,
    }
    _cache_set(_on_vehicle_cache, cache_key, payload)
    return _ok(**payload)
