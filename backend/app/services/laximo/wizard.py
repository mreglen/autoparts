from __future__ import annotations

import hashlib
import logging
import time
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.services.laximo import cat_client
from app.services.laximo.catalog_features import has_wizardsearch2, list_wizard_catalogs
from app.services.laximo.cat_client import LaximoCatError
from app.services.laximo.gate import (
    PUBLIC_NOT_FOUND,
    PUBLIC_OK,
    PUBLIC_TEMPORARILY_UNAVAILABLE,
    assert_public_message_safe,
    laximo_cat_ready,
    public_message_for_reason,
)
from app.services.laximo.unit_tree import SoftEnvelope
from app.services.laximo.vehicle_normalize import normalize_find_vehicle_row

logger = logging.getLogger(__name__)

WIZARD_CACHE_TTL_SEC = 1800

_wizard_step_cache: dict[str, tuple[float, dict[str, Any]]] = {}


def clear_wizard_cache() -> None:
    _wizard_step_cache.clear()


def _unavailable() -> SoftEnvelope:
    _, message = public_message_for_reason(PUBLIC_TEMPORARILY_UNAVAILABLE)
    assert_public_message_safe(message)
    return SoftEnvelope(
        ok=False,
        reason=PUBLIC_TEMPORARILY_UNAVAILABLE,
        message=message,
    )


def _not_found() -> SoftEnvelope:
    _, message = public_message_for_reason(PUBLIC_NOT_FOUND)
    assert_public_message_safe(message)
    return SoftEnvelope(
        ok=False,
        reason=PUBLIC_NOT_FOUND,
        message=message,
    )


def _ok(**payload: Any) -> SoftEnvelope:
    return SoftEnvelope(ok=True, reason=PUBLIC_OK, message=None, payload=dict(payload))


def _ssd_hash(ssd: str) -> str:
    return hashlib.sha256((ssd or "").encode("utf-8")).hexdigest()[:16]


def _cache_get(key: str) -> Optional[dict[str, Any]]:
    entry = _wizard_step_cache.get(key)
    if not entry:
        return None
    expires_at, value = entry
    if time.monotonic() >= expires_at:
        _wizard_step_cache.pop(key, None)
        return None
    return value


def _cache_set(key: str, value: dict[str, Any]) -> None:
    _wizard_step_cache[key] = (time.monotonic() + WIZARD_CACHE_TTL_SEC, value)


def list_catalogs_for_wizard(db: Session) -> SoftEnvelope:
    if not laximo_cat_ready(db):
        return _unavailable()
    try:
        catalogs = list_wizard_catalogs(db)
    except LaximoCatError:
        logger.exception("list_wizard_catalogs failed")
        return _unavailable()
    except Exception:
        logger.exception("Unexpected wizard catalogs error")
        return _unavailable()
    return _ok(catalogs=catalogs)


def get_wizard_step(
    db: Session,
    *,
    catalog: str,
    ssd: str = "",
) -> SoftEnvelope:
    if not laximo_cat_ready(db):
        return _unavailable()

    cat = (catalog or "").strip()
    if not cat:
        return SoftEnvelope(
            ok=False,
            reason=PUBLIC_TEMPORARILY_UNAVAILABLE,
            message="Укажите каталог для подбора",
        )

    try:
        if not has_wizardsearch2(db, cat):
            return _ok(
                catalog=cat,
                ssd=(ssd or "").strip() or None,
                conditions=[],
                can_list_vehicles=False,
            )
    except LaximoCatError:
        logger.exception("Failed to read wizardsearch2 for %s", cat)
        return _unavailable()
    except Exception:
        logger.exception("Unexpected features error for wizard")
        return _unavailable()

    ssd_text = (ssd or "").strip()
    cache_key = f"wiz:{cat}:{_ssd_hash(ssd_text)}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return _ok(**cached)

    try:
        conditions = cat_client.get_wizard2(
            db, catalog=cat, ssd=ssd_text, count_toward_quota=True
        )
    except LaximoCatError:
        logger.exception("GetWizard2 failed")
        return _unavailable()
    except Exception:
        logger.exception("Unexpected GetWizard2 error")
        return _unavailable()

    can_list = any(bool(c.get("allow_list_vehicles")) for c in conditions)
    payload = {
        "catalog": cat,
        "ssd": ssd_text or None,
        "conditions": conditions,
        "can_list_vehicles": can_list,
    }
    _cache_set(cache_key, payload)
    return _ok(**payload)


def find_by_wizard(
    db: Session,
    *,
    catalog: str,
    ssd: str,
) -> SoftEnvelope:
    if not laximo_cat_ready(db):
        return _unavailable()

    cat = (catalog or "").strip()
    ssd_text = (ssd or "").strip()
    if not cat or not ssd_text:
        return SoftEnvelope(
            ok=False,
            reason=PUBLIC_TEMPORARILY_UNAVAILABLE,
            message="Недостаточно данных для подбора автомобиля",
        )

    try:
        if not has_wizardsearch2(db, cat):
            return _ok(candidates=[])
    except LaximoCatError:
        return _unavailable()
    except Exception:
        logger.exception("Unexpected features error for FindVehicleByWizard2")
        return _unavailable()

    try:
        rows = cat_client.find_vehicle_by_wizard2(
            db, catalog=cat, ssd=ssd_text, count_toward_quota=True
        )
    except LaximoCatError:
        logger.exception("FindVehicleByWizard2 failed")
        return _unavailable()
    except Exception:
        logger.exception("Unexpected FindVehicleByWizard2 error")
        return _unavailable()

    if not rows:
        return _not_found()

    candidates = [normalize_find_vehicle_row(row).to_dict() for row in rows]
    return _ok(candidates=candidates)
