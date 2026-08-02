from __future__ import annotations

import logging
import time
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.services.laximo import cat_client
from app.services.laximo.catalog_features import has_detailapplicability
from app.services.laximo.cat_client import LaximoCatError
from app.services.laximo.gate import (
    PUBLIC_OK,
    PUBLIC_TEMPORARILY_UNAVAILABLE,
    assert_public_message_safe,
    laximo_cat_ready,
    public_message_for_reason,
)
from app.services.laximo.unit_tree import SoftEnvelope
from app.utils.partnumber import normalize_partnumber

logger = logging.getLogger(__name__)

CACHE_TTL_SEC = 3600
CATALOG_CAP = 2
VEHICLE_CAP = 24

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
    return {
        "brand": row.get("brand"),
        "name": row.get("name"),
        "catalog": row.get("catalog"),
        "vehicle_id": row.get("vehicle_id"),
        "year_from": year_from,
        "year_to": year_to,
        "attributes": attributes or None,
    }


def _pick_catalogs(
    catalogs: list[dict[str, Any]],
    *,
    brand: Optional[str],
) -> list[dict[str, Any]]:
    if not catalogs:
        return []
    brand_norm = (brand or "").strip().casefold()
    preferred: list[dict[str, Any]] = []
    others: list[dict[str, Any]] = []
    for cat in catalogs:
        cat_brand = (cat.get("brand") or cat.get("name") or "").strip().casefold()
        if brand_norm and cat_brand and (
            brand_norm in cat_brand or cat_brand in brand_norm
        ):
            preferred.append(cat)
        else:
            others.append(cat)
    ordered = preferred + others
    return ordered[:CATALOG_CAP]


def lookup_applicable_vehicles(
    db: Session,
    *,
    oem: str,
    brand: Optional[str] = None,
) -> SoftEnvelope:
    """FindPartReferences → FindApplicableVehicles. Soft-fail; empty ok when no data."""
    if not laximo_cat_ready(db):
        return _unavailable()

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

    try:
        catalogs = cat_client.find_part_references(
            db, oem=oem_raw, count_toward_quota=True
        )
    except LaximoCatError:
        logger.exception("FindPartReferences failed")
        return _unavailable()
    except Exception:
        logger.exception("Unexpected FindPartReferences error")
        return _unavailable()

    if not catalogs:
        payload = {"oem": oem_raw, "vehicles": []}
        _cache_set(_applicable_cache, cache_key, payload)
        return _ok(**payload)

    selected = _pick_catalogs(catalogs, brand=brand)
    vehicles: list[dict[str, Any]] = []
    seen: set[str] = set()

    for cat in selected:
        code = (cat.get("code") or "").strip()
        if not code:
            continue
        try:
            if not has_detailapplicability(db, code):
                continue
        except LaximoCatError:
            logger.exception("Failed to read catalog features for %s", code)
            return _unavailable()
        except Exception:
            logger.exception("Unexpected features error for %s", code)
            return _unavailable()

        try:
            rows = cat_client.find_applicable_vehicles(
                db, catalog=code, oem=oem_raw, count_toward_quota=True
            )
        except LaximoCatError:
            logger.exception("FindApplicableVehicles failed for %s", code)
            return _unavailable()
        except Exception:
            logger.exception("Unexpected FindApplicableVehicles error for %s", code)
            return _unavailable()

        for row in rows:
            normalized = _normalize_vehicle_row(row)
            brand_text = (normalized.get("brand") or "").strip()
            name_text = (normalized.get("name") or "").strip()
            if not brand_text and not name_text:
                continue
            dedupe = f"{brand_text.casefold()}|{name_text.casefold()}|{normalized.get('vehicle_id') or ''}"
            if dedupe in seen:
                continue
            seen.add(dedupe)
            vehicles.append(normalized)
            if len(vehicles) >= VEHICLE_CAP:
                break
        if len(vehicles) >= VEHICLE_CAP:
            break

    payload = {"oem": oem_raw, "vehicles": vehicles}
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
