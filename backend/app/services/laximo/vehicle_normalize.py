from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from typing import Any, Optional


@dataclass
class NormalizedVehicleCandidate:
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    engine: Optional[str] = None
    transmission: Optional[str] = None
    body: Optional[str] = None
    color: Optional[str] = None
    display_name: Optional[str] = None
    catalog: Optional[str] = None
    vehicle_id: Optional[str] = None
    ssd: Optional[str] = None
    filter_level: Optional[str] = None
    attributes_raw: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _attr_map(attributes: Any) -> dict[str, str]:
    result: dict[str, str] = {}
    if not isinstance(attributes, list):
        return result
    for item in attributes:
        if not isinstance(item, dict):
            continue
        key = str(item.get("key") or "").strip().lower()
        value = item.get("value")
        if not key or value is None:
            continue
        text = str(value).strip()
        if text:
            result[key] = text
    return result


def _first(attrs: dict[str, str], *keys: str) -> Optional[str]:
    for key in keys:
        val = attrs.get(key.lower())
        if val:
            return val
    return None


def _parse_year(raw: Optional[str]) -> Optional[int]:
    if not raw:
        return None
    text = str(raw).strip()
    # Prefer 4-digit year; manufactured may be YYYY or YYYYMMDD / date with dots
    match = re.search(r"(19|20)\d{2}", text)
    if not match:
        return None
    year = int(match.group(0))
    if 1900 <= year <= 2100:
        return year
    return None


def _raw_attributes(attributes: Any) -> list[dict[str, Any]]:
    if not isinstance(attributes, list):
        return []
    out: list[dict[str, Any]] = []
    for item in attributes:
        if not isinstance(item, dict):
            continue
        key = item.get("key")
        value = item.get("value")
        if key is None and value is None:
            continue
        entry: dict[str, Any] = {
            "key": None if key is None else str(key),
            "value": None if value is None else str(value),
        }
        name = item.get("name")
        if name is not None and str(name).strip():
            entry["name"] = str(name)
        out.append(entry)
    return out


def normalize_find_vehicle_row(row: dict[str, Any]) -> NormalizedVehicleCandidate:
    brand = (row.get("brand") or "").strip() or None
    name = (row.get("name") or "").strip() or None
    catalog = (row.get("catalog") or "").strip() or None
    vehicle_id = row.get("vehicleId")
    if vehicle_id is None:
        vehicle_id = row.get("vehicleid")
    vehicle_id_str = None if vehicle_id is None else str(vehicle_id).strip() or None
    ssd = row.get("ssd")
    ssd_str = None if ssd is None else str(ssd)

    sys_props = row.get("sysProperties") or row.get("sysproperties") or {}
    filter_level = None
    if isinstance(sys_props, dict):
        fl = sys_props.get("filter_level") or sys_props.get("filterLevel")
        if fl is not None:
            filter_level = str(fl)

    attrs = _attr_map(row.get("attributes"))
    model = _first(attrs, "model", "modification", "description") or name
    year = _parse_year(
        _first(attrs, "manufactured", "date", "modelyearfrom", "modelyear", "prodrange")
    )
    engine = _first(attrs, "engine_info", "engine", "engine1", "engine2")
    transmission = _first(attrs, "transmission")
    body = _first(attrs, "frame", "bodystyle", "frames", "car_type_string")
    color = _first(attrs, "framecolor", "exteriorcolor", "color")

    display_parts = [p for p in (brand, name) if p]
    display_name = " ".join(display_parts) if display_parts else None

    return NormalizedVehicleCandidate(
        make=brand,
        model=model,
        year=year,
        engine=engine,
        transmission=transmission,
        body=body,
        color=color,
        display_name=display_name,
        catalog=catalog,
        vehicle_id=vehicle_id_str,
        ssd=ssd_str,
        filter_level=filter_level,
        attributes_raw=_raw_attributes(row.get("attributes")),
    )


def _plate_full_str(card: dict[str, Any], *keys: str) -> Optional[str]:
    for key in keys:
        val = card.get(key)
        if val is None:
            continue
        text = str(val).strip()
        if text:
            return text
    return None


def normalize_plate_full_card(card: dict[str, Any]) -> Optional[NormalizedVehicleCandidate]:
    """Build a candidate from identifyByPlateNumberFull when FindVehicle is unavailable."""
    if not isinstance(card, dict) or not card:
        return None
    make = _plate_full_str(card, "car_mark", "td_mark")
    model = _plate_full_str(card, "car_model", "td_model")
    if not make and not model:
        return None

    year = _parse_year(_plate_full_str(card, "manufacturing_year"))
    engine = _plate_full_str(card, "engine_model")
    color = _plate_full_str(card, "color")
    body = _plate_full_str(card, "car_type_string")
    modification = _plate_full_str(card, "car_modification", "td_modification")
    if modification and model and modification not in model:
        model_display = f"{model} {modification}".strip()
    else:
        model_display = model

    display_parts = [p for p in (make, model_display) if p]
    display_name = " ".join(display_parts) if display_parts else None

    raw_attrs: list[dict[str, Any]] = []
    for key, value in card.items():
        if value is None or value == "":
            continue
        raw_attrs.append({"key": str(key), "value": str(value)})

    return NormalizedVehicleCandidate(
        make=make,
        model=model_display or model,
        year=year,
        engine=engine,
        transmission=None,
        body=body,
        color=color,
        display_name=display_name,
        catalog=None,
        vehicle_id=None,
        ssd=None,
        filter_level=None,
        attributes_raw=raw_attrs,
    )


def enrich_candidate_from_plate_full(
    candidate: NormalizedVehicleCandidate,
    card: dict[str, Any],
) -> NormalizedVehicleCandidate:
    """Fill missing fields on a FindVehicle candidate from plate-full card."""
    if not isinstance(card, dict):
        return candidate
    if not candidate.make:
        candidate.make = _plate_full_str(card, "car_mark", "td_mark")
    if not candidate.model:
        candidate.model = _plate_full_str(card, "car_model", "td_model")
    if candidate.year is None:
        candidate.year = _parse_year(_plate_full_str(card, "manufacturing_year"))
    if not candidate.engine:
        candidate.engine = _plate_full_str(card, "engine_model")
    if not candidate.color:
        candidate.color = _plate_full_str(card, "color")
    if not candidate.body:
        candidate.body = _plate_full_str(card, "car_type_string")
    if not candidate.display_name:
        parts = [p for p in (candidate.make, candidate.model) if p]
        candidate.display_name = " ".join(parts) if parts else None
    return candidate
