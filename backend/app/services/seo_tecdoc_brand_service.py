from __future__ import annotations

import json
from pathlib import Path

_BRAND_MAP_PATH = (
    Path(__file__).resolve().parents[2] / "data" / "tecdoc_rossko_brand_map.json"
)

_BUILTIN_ALIASES: dict[str, str] = {
    "MANN-FILTER": "MANN",
    "MANN FILTER": "MANN",
    "FEBI BILSTEIN": "FEBI",
    "KNECHT": "MAHLE",
    "MAHLE ORIGINAL": "MAHLE",
    "VALEO SERVICE": "VALEO",
    "TRW AUTOMOTIVE": "TRW",
    "BOSCH AUTOMOTIVE": "BOSCH",
    "CONTINENTAL AUTOMOTIVE": "CONTITECH",
    "CONTINENTAL": "CONTITECH",
    "GATES CORPORATION": "GATES",
    "SKF AUTOMOTIVE": "SKF",
    "LEMFÖRDER": "LEMFORDER",
    "LEMFORDER": "LEMFORDER",
    "BLUE PRINT": "BLUEPRINT",
    "JAPANPARTS": "JAPAN PARTS",
    "HYUNDAI / KIA": "HYUNDAI",
    "HYUNDAI/KIA": "HYUNDAI",
    "VAG GROUP": "VAG",
    "VW": "VAG",
    "VOLKSWAGEN": "VAG",
    "AUDI AG": "AUDI",
    "GENERAL MOTORS": "GM",
    "GM OE": "GM",
}


def _normalize_brand_key(brand: str) -> str:
    return " ".join((brand or "").strip().upper().split())


def _load_json_aliases() -> dict[str, str]:
    if not _BRAND_MAP_PATH.is_file():
        return {}
    try:
        data = json.loads(_BRAND_MAP_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    if not isinstance(data, dict):
        return {}
    return {_normalize_brand_key(str(key)): str(value).strip().upper() for key, value in data.items()}


def map_tecdoc_brand_to_rossko(brand: str) -> str:
    """Map TecDoc supplier name to Rossko-friendly brand for GetSearch."""
    raw = (brand or "").strip()
    if not raw:
        return raw
    key = _normalize_brand_key(raw)
    json_aliases = _load_json_aliases()
    if key in json_aliases:
        return json_aliases[key]
    if key in _BUILTIN_ALIASES:
        return _BUILTIN_ALIASES[key]
    return raw.upper()


_ROSSKO_AFTERMARKET_WHITELIST: set[str] = {
    "AUDI",
    "BLUEPRINT",
    "BOSCH",
    "BREMBO",
    "CONTITECH",
    "DAYCO",
    "DENSO",
    "FAG",
    "FEBI",
    "FILTRON",
    "FORD",
    "GATES",
    "GM",
    "HENGST",
    "HYUNDAI",
    "JAPAN PARTS",
    "KAYABA",
    "LEMFORDER",
    "MAHLE",
    "MANN",
    "MEYLE",
    "NGK",
    "NISSAN",
    "OPEL",
    "PEUGEOT",
    "PURFLUX",
    "SACHS",
    "SKF",
    "TOYOTA",
    "TRW",
    "VAG",
    "VALEO",
    "ZIMMERMANN",
}


def is_tecdoc_brand_whitelisted(brand: str, *, extra_brands: set[str] | None = None) -> bool:
    mapped = map_tecdoc_brand_to_rossko(brand)
    keys = {_normalize_brand_key(mapped), _normalize_brand_key(brand)}
    if keys & _ROSSKO_AFTERMARKET_WHITELIST:
        return True
    if extra_brands:
        normalized_extra = {" ".join(item.strip().upper().split()) for item in extra_brands if item}
        if keys & normalized_extra:
            return True
    return False
