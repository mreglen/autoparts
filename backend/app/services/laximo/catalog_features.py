from __future__ import annotations

import logging
import time
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.services.laximo.cat_client import LaximoCatError, list_catalogs

logger = logging.getLogger(__name__)

FEATURES_TTL_SEC = 24 * 3600

# Process-local: expires_at -> map catalog_code_lower -> set of feature names
_features_cache: dict[str, Any] = {"expires_at": 0.0, "by_code": {}}


def clear_catalog_features_cache() -> None:
    _features_cache["expires_at"] = 0.0
    _features_cache["by_code"] = {}


def _extract_feature_names(row: dict[str, Any]) -> set[str]:
    names: set[str] = set()
    features = row.get("features")
    if isinstance(features, list):
        for item in features:
            if isinstance(item, str) and item.strip():
                names.add(item.strip().lower())
            elif isinstance(item, dict):
                name = item.get("name") or item.get("code") or item.get("feature")
                if name and str(name).strip():
                    names.add(str(name).strip().lower())
    elif isinstance(features, dict):
        for key, value in features.items():
            if value is True or value == 1 or value == "true":
                names.add(str(key).strip().lower())
            elif isinstance(value, str) and value.strip():
                names.add(value.strip().lower())
        for key in features.keys():
            if str(key).strip():
                names.add(str(key).strip().lower())
    for key, value in row.items():
        kl = str(key).strip().lower()
        if kl in (
            "quickgroups",
            "vinsearch",
            "framesearch",
            "wizardsearch2",
            "fulltextsearch",
            "detailapplicability",
        ):
            if value is True or value == 1 or str(value).lower() in ("true", "1", "yes"):
                names.add(kl)
    return names


def _catalog_code(row: dict[str, Any]) -> Optional[str]:
    for key in ("code", "catalog", "catalogCode", "catalogcode"):
        val = row.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    return None


def _load_features_map(db: Session) -> dict[str, set[str]]:
    now = time.monotonic()
    if now < float(_features_cache["expires_at"]) and _features_cache["by_code"]:
        return _features_cache["by_code"]

    try:
        rows = list_catalogs(db, count_toward_quota=False)
    except LaximoCatError:
        logger.exception("Failed to refresh Laximo catalog features")
        if _features_cache["by_code"]:
            return _features_cache["by_code"]
        raise

    by_code: dict[str, set[str]] = {}
    for row in rows:
        code = _catalog_code(row)
        if not code:
            continue
        by_code[code.lower()] = _extract_feature_names(row)

    _features_cache["by_code"] = by_code
    _features_cache["expires_at"] = now + FEATURES_TTL_SEC
    return by_code


def get_catalog_features(db: Session, catalog_code: str) -> set[str]:
    code = (catalog_code or "").strip()
    if not code:
        return set()
    by_code = _load_features_map(db)
    return set(by_code.get(code.lower()) or set())


def has_quickgroups(db: Session, catalog_code: str) -> bool:
    return "quickgroups" in get_catalog_features(db, catalog_code)


def has_fulltextsearch(db: Session, catalog_code: str) -> bool:
    return "fulltextsearch" in get_catalog_features(db, catalog_code)


def has_detailapplicability(db: Session, catalog_code: str) -> bool:
    return "detailapplicability" in get_catalog_features(db, catalog_code)


def has_wizardsearch2(db: Session, catalog_code: str) -> bool:
    return "wizardsearch2" in get_catalog_features(db, catalog_code)


def list_wizard_catalogs(db: Session) -> list[dict[str, Any]]:
    """Catalogs that support wizardsearch2 (ListCatalogs, no quota)."""
    try:
        rows = list_catalogs(db, count_toward_quota=False)
    except LaximoCatError:
        logger.exception("Failed to list catalogs for wizard")
        raise
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in rows:
        code = _catalog_code(row)
        if not code:
            continue
        features = _extract_feature_names(row)
        if "wizardsearch2" not in features:
            continue
        key = code.lower()
        if key in seen:
            continue
        seen.add(key)
        brand = row.get("brand") or row.get("Brand")
        name = row.get("name") or row.get("Name")
        out.append(
            {
                "code": code,
                "brand": str(brand).strip() if brand else None,
                "name": str(name).strip() if name else None,
            }
        )
    out.sort(key=lambda c: ((c.get("brand") or c.get("name") or c["code"]).lower()))
    return out
