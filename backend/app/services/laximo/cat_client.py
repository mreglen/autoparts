from __future__ import annotations

import logging
from typing import Any, Optional

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.site_laximo_cat_integration import DEFAULT_LAXIMO_CAT_BASE_URL
from app.services.laximo.gate import (
    credentials_configured,
    get_plain_credentials,
    increment_laximo_request_counter,
    record_upstream_error,
)
from app.utils.laximo_cat_integration_db import get_or_create_laximo_cat_integration

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_SEC = 30.0
ACCEPT_LANGUAGE = "ru_RU"


class LaximoCatError(Exception):
    def __init__(self, message: str, *, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def _resolve_credentials(db: Session) -> tuple[str, str, str]:
    row = get_or_create_laximo_cat_integration(db)
    login, password = get_plain_credentials(row)
    base_url = (row.base_url or "").strip() or DEFAULT_LAXIMO_CAT_BASE_URL

    if not login or not password:
        env_login = (settings.LAXIMO_CAT_LOGIN or "").strip()
        env_password = (settings.LAXIMO_CAT_PASSWORD or "").strip()
        if env_login and env_password:
            login = env_login
            password = env_password
            if (settings.LAXIMO_CAT_BASE or "").strip():
                base_url = settings.LAXIMO_CAT_BASE.strip().rstrip("/")

    if not login or not password:
        raise LaximoCatError("Laximo.CAT credentials are not configured")

    return login, password, base_url.rstrip("/")


def request_cat(
    db: Session,
    path: str,
    *,
    params: Optional[dict[str, Any]] = None,
    count_toward_quota: bool = True,
    timeout_sec: float = DEFAULT_TIMEOUT_SEC,
) -> Any:
    """
    POST to Laximo.CAT REST endpoint.
    Does not log password. Product calls should pass count_toward_quota=True;
    admin test must pass False.
    """
    login, password, base_url = _resolve_credentials(db)
    url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"

    try:
        with httpx.Client(timeout=timeout_sec) as client:
            response = client.post(
                url,
                params=params or None,
                auth=(login, password),
                headers={
                    "accept": "application/json",
                    "accept-language": ACCEPT_LANGUAGE,
                },
            )
    except httpx.TimeoutException as exc:
        if count_toward_quota:
            try:
                increment_laximo_request_counter(db)
            except Exception:
                logger.exception("Failed to increment Laximo request counter")
        record_upstream_error(db, "timeout")
        raise LaximoCatError("Laximo.CAT request timed out") from exc
    except httpx.HTTPError as exc:
        if count_toward_quota:
            try:
                increment_laximo_request_counter(db)
            except Exception:
                logger.exception("Failed to increment Laximo request counter")
        record_upstream_error(db, "network error")
        raise LaximoCatError("Laximo.CAT network error") from exc

    if count_toward_quota:
        try:
            increment_laximo_request_counter(db)
        except Exception:
            logger.exception("Failed to increment Laximo request counter")

    if response.status_code >= 400:
        # Never include response body secrets; keep message admin-safe.
        detail = f"HTTP {response.status_code}"
        record_upstream_error(db, detail)
        raise LaximoCatError(detail, status_code=response.status_code)

    if not response.content:
        return []
    try:
        return response.json()
    except ValueError as exc:
        record_upstream_error(db, "invalid JSON response")
        raise LaximoCatError("Laximo.CAT returned invalid JSON") from exc


def list_catalogs(db: Session, *, count_toward_quota: bool = False) -> list[dict[str, Any]]:
    data = request_cat(db, "/listCatalogs", count_toward_quota=count_toward_quota)
    return _as_dict_list(data)


def find_vehicle(
    db: Session,
    ident_string: str,
    *,
    count_toward_quota: bool = True,
) -> list[dict[str, Any]]:
    """POST /findVehicle — VIN or Frame search (REST)."""
    ident = (ident_string or "").strip()
    if not ident:
        raise LaximoCatError("identString is required")
    data = request_cat(
        db,
        "/findVehicle",
        params={"identString": ident, "localized": "true"},
        count_toward_quota=count_toward_quota,
    )
    return _as_dict_list(data)


def find_vehicle_by_plate_number(
    db: Session,
    plate_number: str,
    *,
    country_code: str = "ru",
    catalog: Optional[str] = None,
    count_toward_quota: bool = True,
) -> list[dict[str, Any]]:
    """POST /findVehicleByPlateNumber — catalog vehicle candidates by RU plate."""
    plate = (plate_number or "").strip()
    if not plate:
        raise LaximoCatError("plateNumber is required")
    cc = (country_code or "ru").strip().lower() or "ru"
    params: dict[str, Any] = {
        "countryCode": cc,
        "plateNumber": plate,
        "localized": "true",
    }
    if catalog:
        params["catalog"] = catalog.strip()
    data = request_cat(
        db,
        "/findVehicleByPlateNumber",
        params=params,
        count_toward_quota=count_toward_quota,
    )
    return _as_dict_list(data)


def identify_by_plate_number_full(
    db: Session,
    plate_number: str,
    *,
    country_code: str = "ru",
    count_toward_quota: bool = True,
) -> dict[str, Any]:
    """
    POST /identifyByPlateNumberFull — VIN + rich vehicle card by RU plate.
    Returns a single dict (empty if nothing useful).
    """
    plate = (plate_number or "").strip()
    if not plate:
        raise LaximoCatError("plateNumber is required")
    cc = (country_code or "ru").strip().lower() or "ru"
    data = request_cat(
        db,
        "/identifyByPlateNumberFull",
        params={"countryCode": cc, "plateNumber": plate},
        count_toward_quota=count_toward_quota,
    )
    if data is None:
        return {}
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict) and item:
                return item
        return {}
    if isinstance(data, dict):
        return data
    return {}


def search_vehicle_details(
    db: Session,
    *,
    catalog: str,
    vehicle_id: str,
    ssd: str,
    query: str,
    count_toward_quota: bool = True,
) -> list[dict[str, Any]]:
    """
    POST /searchVehicleDetails — fulltext part search within a vehicle.
    Returns list of {oem, name} dicts.
    """
    cat = (catalog or "").strip()
    vid = (vehicle_id or "").strip()
    ssd_text = (ssd or "").strip()
    q = (query or "").strip()
    if not cat or not vid or not ssd_text:
        raise LaximoCatError("catalog, vehicleId and ssd are required")
    if not q:
        raise LaximoCatError("query is required")

    data = request_cat(
        db,
        "/searchVehicleDetails",
        params={
            "catalog": cat,
            "vehicleId": vid,
            "ssd": ssd_text,
            "query": q,
        },
        count_toward_quota=count_toward_quota,
    )
    rows = _as_dict_list(data, nested_keys=("details", "rows", "items", "data"))
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in rows:
        oem = row.get("oem") or row.get("OEM") or row.get("article")
        name = row.get("name") or row.get("Name")
        if name is None and isinstance(row.get("#text"), str):
            name = row.get("#text")
        oem_text = str(oem).strip() if oem is not None else ""
        if not oem_text:
            continue
        key = oem_text.upper()
        if key in seen:
            continue
        seen.add(key)
        out.append(
            {
                "oem": oem_text,
                "name": str(name).strip() if name else None,
            }
        )
    return out


def find_part_references(
    db: Session,
    *,
    oem: str,
    count_toward_quota: bool = True,
) -> list[dict[str, Any]]:
    """
    POST /findPartReferences — catalogs where OEM appears.
    Returns list of {code, brand, name} catalog dicts.
    """
    oem_text = (oem or "").strip()
    if not oem_text:
        raise LaximoCatError("oem is required")
    data = request_cat(
        db,
        "/findPartReferences",
        params={"oem": oem_text},
        count_toward_quota=count_toward_quota,
    )
    catalogs: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in _as_dict_list(data, nested_keys=("rows", "items", "data")):
        nested = row.get("catalogs")
        catalog_rows: list[Any]
        if isinstance(nested, list):
            catalog_rows = nested
        elif isinstance(nested, dict):
            catalog_rows = [nested]
        else:
            # Flat row that is already a catalog
            if row.get("code") or row.get("catalog") or row.get("catalogCode"):
                catalog_rows = [row]
            else:
                continue
        for cat in catalog_rows:
            if not isinstance(cat, dict):
                continue
            code = (
                cat.get("code")
                or cat.get("catalog")
                or cat.get("catalogCode")
                or cat.get("catalogcode")
            )
            code_text = str(code).strip() if code is not None else ""
            if not code_text:
                continue
            key = code_text.lower()
            if key in seen:
                continue
            seen.add(key)
            brand = cat.get("brand") or cat.get("Brand")
            name = cat.get("name") or cat.get("Name")
            catalogs.append(
                {
                    "code": code_text,
                    "brand": str(brand).strip() if brand else None,
                    "name": str(name).strip() if name else None,
                }
            )
    return catalogs


def find_applicable_vehicles(
    db: Session,
    *,
    catalog: str,
    oem: str,
    count_toward_quota: bool = True,
) -> list[dict[str, Any]]:
    """
    POST /findApplicableVehicles — vehicles in catalog that use OEM.
    Returns normalized list of vehicle dicts.
    """
    cat = (catalog or "").strip()
    oem_text = (oem or "").strip()
    if not cat or not oem_text:
        raise LaximoCatError("catalog and oem are required")
    data = request_cat(
        db,
        "/findApplicableVehicles",
        params={"catalog": cat, "oem": oem_text, "localized": "true"},
        count_toward_quota=count_toward_quota,
    )
    out: list[dict[str, Any]] = []
    for row in _as_dict_list(
        data, nested_keys=("vehicles", "rows", "items", "data")
    ):
        brand = row.get("brand") or row.get("Brand")
        name = row.get("name") or row.get("Name")
        vid = row.get("vehicleId") or row.get("vehicle_id") or row.get("id")
        ssd = row.get("ssd") or row.get("SSD")
        catalog_code = row.get("catalog") or row.get("catalogCode") or cat
        attrs_raw = row.get("attributes")
        attributes: list[dict[str, Any]] = []
        if isinstance(attrs_raw, list):
            for item in attrs_raw:
                if isinstance(item, dict):
                    attributes.append(item)
        elif isinstance(attrs_raw, dict):
            for key, value in attrs_raw.items():
                attributes.append({"key": key, "value": value, "name": key})
        out.append(
            {
                "catalog": str(catalog_code).strip() if catalog_code else cat,
                "brand": str(brand).strip() if brand else None,
                "name": str(name).strip() if name else None,
                "vehicle_id": str(vid).strip() if vid is not None else None,
                "ssd": str(ssd).strip() if ssd else None,
                "attributes": attributes,
            }
        )
    return out


def get_oem_part_applicability(
    db: Session,
    *,
    catalog: str,
    ssd: str,
    oem: str,
    all_details: bool = False,
    count_toward_quota: bool = True,
) -> dict[str, Any]:
    """
    POST /getOEMPartApplicability — where OEM sits on a specific vehicle (ssd).
    Returns {applicability, categories, units}.
    """
    cat = (catalog or "").strip()
    ssd_text = (ssd or "").strip()
    oem_text = (oem or "").strip()
    if not cat or not ssd_text or not oem_text:
        raise LaximoCatError("catalog, ssd and oem are required")
    params: dict[str, Any] = {
        "catalog": cat,
        "ssd": ssd_text,
        "oem": oem_text,
        "localized": "true",
    }
    if all_details:
        params["all"] = "true"
    data = request_cat(
        db,
        "/getOEMPartApplicability",
        params=params,
        count_toward_quota=count_toward_quota,
    )
    payload: dict[str, Any] = {}
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict) and item:
                payload = item
                break
    elif isinstance(data, dict):
        payload = data

    applicability = (
        payload.get("applicability")
        or payload.get("Applicability")
        or "NONAPPLICABLE"
    )
    categories_raw = payload.get("categories") or payload.get("Categories") or []
    if isinstance(categories_raw, dict):
        categories_raw = [categories_raw]
    if not isinstance(categories_raw, list):
        categories_raw = []

    units: list[dict[str, Any]] = []
    seen_units: set[str] = set()
    for cat_row in categories_raw:
        if not isinstance(cat_row, dict):
            continue
        units_raw = cat_row.get("units") or cat_row.get("Units") or []
        if isinstance(units_raw, dict):
            units_raw = [units_raw]
        if not isinstance(units_raw, list):
            continue
        for unit in units_raw:
            if not isinstance(unit, dict):
                continue
            unit_id = unit.get("unitId") or unit.get("unit_id") or unit.get("id")
            code = unit.get("code") or unit.get("Code")
            name = unit.get("name") or unit.get("Name")
            key = str(unit_id or code or name or "").strip().lower()
            if not key or key in seen_units:
                continue
            seen_units.add(key)
            units.append(
                {
                    "unit_id": str(unit_id).strip() if unit_id is not None else None,
                    "code": str(code).strip() if code else None,
                    "name": str(name).strip() if name else None,
                }
            )
    return {
        "applicability": str(applicability).strip().upper() or "NONAPPLICABLE",
        "categories": [c for c in categories_raw if isinstance(c, dict)],
        "units": units,
    }


def _normalize_filter_conditions(data: Any) -> list[dict[str, Any]]:
    rows = _as_dict_list(data, nested_keys=("conditions", "rows", "items", "data", "filters"))
    out: list[dict[str, Any]] = []
    for row in rows:
        name = row.get("name") or row.get("Name")
        type_raw = row.get("type") or row.get("Type") or "list"
        type_text = str(type_raw).strip().lower() or "list"
        if type_text not in ("list", "input"):
            type_text = "list"
        regexp = row.get("regexp") or row.get("Regexp")
        ssd_mod = (
            row.get("ssdModification")
            or row.get("ssdmodification")
            or row.get("ssd_modification")
        )
        values_raw = row.get("values") or row.get("Values") or []
        if isinstance(values_raw, dict):
            values_raw = [values_raw]
        if not isinstance(values_raw, list):
            values_raw = []
        values: list[dict[str, Any]] = []
        for item in values_raw:
            if not isinstance(item, dict):
                continue
            v_name = item.get("name") or item.get("Name")
            v_note = item.get("note") or item.get("Note")
            v_mod = (
                item.get("ssdModification")
                or item.get("ssdmodification")
                or item.get("ssd_modification")
            )
            values.append(
                {
                    "name": str(v_name).strip() if v_name else None,
                    "note": str(v_note).strip() if v_note else None,
                    "ssd_modification": str(v_mod).strip() if v_mod else None,
                }
            )
        out.append(
            {
                "name": str(name).strip() if name else None,
                "type": type_text,
                "regexp": str(regexp).strip() if regexp else None,
                "ssd_modification": str(ssd_mod).strip() if ssd_mod else None,
                "values": values,
            }
        )
    return out


def get_filter_by_unit(
    db: Session,
    *,
    catalog: str,
    vehicle_id: str,
    ssd: str,
    unit_id: str,
    filter_code: str,
    count_toward_quota: bool = True,
) -> list[dict[str, Any]]:
    """POST /getFilterByUnit — clarification conditions for a unit filter."""
    cat = (catalog or "").strip()
    vid = (vehicle_id or "").strip()
    ssd_text = (ssd or "").strip()
    uid = (unit_id or "").strip()
    fcode = (filter_code or "").strip()
    if not cat or not vid or not ssd_text or not uid or not fcode:
        raise LaximoCatError("catalog, vehicleId, ssd, unitId and filter are required")
    data = request_cat(
        db,
        "/getFilterByUnit",
        params={
            "catalog": cat,
            "vehicleId": vid,
            "ssd": ssd_text,
            "unitId": uid,
            "filter": fcode,
            "localized": "true",
        },
        count_toward_quota=count_toward_quota,
    )
    return _normalize_filter_conditions(data)


def get_filter_by_detail(
    db: Session,
    *,
    catalog: str,
    ssd: str,
    unit_id: str,
    detail_id: str,
    filter_code: str,
    vehicle_id: Optional[str] = None,
    count_toward_quota: bool = True,
) -> list[dict[str, Any]]:
    """POST /getFilterByDetail — clarification conditions for a detail filter."""
    cat = (catalog or "").strip()
    ssd_text = (ssd or "").strip()
    uid = (unit_id or "").strip()
    did = (detail_id or "").strip()
    fcode = (filter_code or "").strip()
    if not cat or not ssd_text or not uid or not did or not fcode:
        raise LaximoCatError(
            "catalog, ssd, unitId, detailId and filter are required"
        )
    params: dict[str, Any] = {
        "catalog": cat,
        "ssd": ssd_text,
        "unitId": uid,
        "detailId": did,
        "filter": fcode,
        "localized": "true",
    }
    vid = (vehicle_id or "").strip()
    if vid:
        params["vehicleId"] = vid
    data = request_cat(
        db,
        "/getFilterByDetail",
        params=params,
        count_toward_quota=count_toward_quota,
    )
    return _normalize_filter_conditions(data)


def get_wizard2(
    db: Session,
    *,
    catalog: str,
    ssd: str = "",
    count_toward_quota: bool = True,
) -> list[dict[str, Any]]:
    """POST /getWizard2 — parameter wizard conditions for a catalog."""
    cat = (catalog or "").strip()
    if not cat:
        raise LaximoCatError("catalog is required")
    params: dict[str, Any] = {
        "catalog": cat,
        "localized": "true",
    }
    ssd_text = (ssd or "").strip()
    if ssd_text:
        params["ssd"] = ssd_text
    data = request_cat(
        db,
        "/getWizard2",
        params=params,
        count_toward_quota=count_toward_quota,
    )
    rows = _as_dict_list(data, nested_keys=("rows", "items", "data", "conditions"))
    out: list[dict[str, Any]] = []
    for row in rows:
        options_raw = row.get("options") or row.get("Options") or []
        if isinstance(options_raw, dict):
            options_raw = [options_raw]
        if not isinstance(options_raw, list):
            options_raw = []
        options: list[dict[str, Any]] = []
        for opt in options_raw:
            if not isinstance(opt, dict):
                continue
            key = opt.get("key") or opt.get("Key") or opt.get("ssd")
            value = opt.get("value") or opt.get("Value") or opt.get("name")
            if key is None and value is None:
                continue
            options.append(
                {
                    "key": str(key).strip() if key is not None else None,
                    "value": str(value).strip() if value is not None else None,
                }
            )
        allow = row.get("allowListVehicles")
        if allow is None:
            allow = row.get("allowlistvehicles") or row.get("allowlistVehicles")
        determined = row.get("determined")
        automatic = row.get("automatic")
        cid = row.get("conditionId") or row.get("conditionid") or row.get("id")
        name = row.get("name") or row.get("Name")
        value = row.get("value") or row.get("Value")
        undo_ssd = row.get("ssd") or row.get("SSD")
        out.append(
            {
                "condition_id": str(cid).strip() if cid is not None else None,
                "name": str(name).strip() if name else None,
                "determined": bool(determined) if determined is not None else False,
                "automatic": bool(automatic) if automatic is not None else False,
                "value": str(value).strip() if value is not None else None,
                "ssd": str(undo_ssd).strip() if undo_ssd else None,
                "allow_list_vehicles": bool(allow) if allow is not None else False,
                "options": options,
            }
        )
    return out


def find_vehicle_by_wizard2(
    db: Session,
    *,
    catalog: str,
    ssd: str,
    count_toward_quota: bool = True,
) -> list[dict[str, Any]]:
    """POST /findVehicleByWizard2 — vehicles matching wizard SSD."""
    cat = (catalog or "").strip()
    ssd_text = (ssd or "").strip()
    if not cat or not ssd_text:
        raise LaximoCatError("catalog and ssd are required")
    data = request_cat(
        db,
        "/findVehicleByWizard2",
        params={
            "catalog": cat,
            "ssd": ssd_text,
            "localized": "true",
        },
        count_toward_quota=count_toward_quota,
    )
    return _as_dict_list(data, nested_keys=("vehicles", "rows", "items", "data"))


def _vehicle_ctx_params(
    *,
    catalog: str,
    vehicle_id: str,
    ssd: str,
    extra: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    params: dict[str, Any] = {
        "catalog": catalog,
        "vehicleId": vehicle_id,
        "ssd": ssd,
        "localized": "true",
    }
    if extra:
        params.update(extra)
    return params


def list_categories(
    db: Session,
    *,
    catalog: str,
    vehicle_id: str,
    ssd: str,
    category_id: str = "-1",
    count_toward_quota: bool = True,
) -> list[dict[str, Any]]:
    data = request_cat(
        db,
        "/listCategories",
        params=_vehicle_ctx_params(
            catalog=catalog,
            vehicle_id=vehicle_id,
            ssd=ssd,
            extra={"categoryId": category_id},
        ),
        count_toward_quota=count_toward_quota,
    )
    return _as_dict_list(data, nested_keys=("categories", "rows", "items", "data"))


def list_units(
    db: Session,
    *,
    catalog: str,
    vehicle_id: str,
    ssd: str,
    category_id: str,
    count_toward_quota: bool = True,
) -> list[dict[str, Any]]:
    data = request_cat(
        db,
        "/listUnits",
        params=_vehicle_ctx_params(
            catalog=catalog,
            vehicle_id=vehicle_id,
            ssd=ssd,
            extra={"categoryId": category_id},
        ),
        count_toward_quota=count_toward_quota,
    )
    return _as_dict_list(data, nested_keys=("units", "rows", "items", "data"))


def get_unit_info(
    db: Session,
    *,
    catalog: str,
    vehicle_id: str,
    ssd: str,
    unit_id: str,
    count_toward_quota: bool = True,
) -> list[dict[str, Any]]:
    data = request_cat(
        db,
        "/getUnitInfo",
        params=_vehicle_ctx_params(
            catalog=catalog,
            vehicle_id=vehicle_id,
            ssd=ssd,
            extra={"unitId": unit_id},
        ),
        count_toward_quota=count_toward_quota,
    )
    return _as_dict_list(data, nested_keys=("unit", "units", "rows", "items", "data"))


def list_detail_by_unit(
    db: Session,
    *,
    catalog: str,
    vehicle_id: str,
    ssd: str,
    unit_id: str,
    count_toward_quota: bool = True,
) -> list[dict[str, Any]]:
    data = request_cat(
        db,
        "/listDetailByUnit",
        params=_vehicle_ctx_params(
            catalog=catalog,
            vehicle_id=vehicle_id,
            ssd=ssd,
            extra={"unitId": unit_id},
        ),
        count_toward_quota=count_toward_quota,
    )
    return _as_dict_list(data, nested_keys=("details", "rows", "items", "data"))


def list_image_map_by_unit(
    db: Session,
    *,
    catalog: str,
    vehicle_id: str,
    ssd: str,
    unit_id: str,
    count_toward_quota: bool = True,
) -> list[dict[str, Any]]:
    data = request_cat(
        db,
        "/listImageMapByUnit",
        params=_vehicle_ctx_params(
            catalog=catalog,
            vehicle_id=vehicle_id,
            ssd=ssd,
            extra={"unitId": unit_id},
        ),
        count_toward_quota=count_toward_quota,
    )
    return _as_dict_list(data, nested_keys=("imageMap", "rows", "items", "data"))


def list_quick_group(
    db: Session,
    *,
    catalog: str,
    vehicle_id: str,
    ssd: str,
    count_toward_quota: bool = True,
) -> list[dict[str, Any]]:
    data = request_cat(
        db,
        "/listQuickGroup",
        params=_vehicle_ctx_params(catalog=catalog, vehicle_id=vehicle_id, ssd=ssd),
        count_toward_quota=count_toward_quota,
    )
    return _as_dict_list(data, nested_keys=("quickGroups", "groups", "rows", "items", "data"))


def list_quick_detail(
    db: Session,
    *,
    catalog: str,
    vehicle_id: str,
    ssd: str,
    quick_group_id: str,
    all_details: bool = True,
    count_toward_quota: bool = True,
) -> list[dict[str, Any]]:
    data = request_cat(
        db,
        "/listQuickDetail",
        params=_vehicle_ctx_params(
            catalog=catalog,
            vehicle_id=vehicle_id,
            ssd=ssd,
            extra={
                "quickGroupId": quick_group_id,
                "all": "true" if all_details else "false",
            },
        ),
        count_toward_quota=count_toward_quota,
    )
    return _as_dict_list(
        data, nested_keys=("details", "units", "rows", "items", "data", "quickDetails")
    )


def _as_dict_list(
    data: Any,
    *,
    nested_keys: tuple[str, ...] = ("vehicles", "rows", "items", "data", "catalogs"),
) -> list[dict[str, Any]]:
    if data is None:
        return []
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if isinstance(data, dict):
        for key in nested_keys:
            nested = data.get(key)
            if isinstance(nested, list):
                return [item for item in nested if isinstance(item, dict)]
        return [data]
    return []


def has_db_credentials(db: Session) -> bool:
    return credentials_configured(get_or_create_laximo_cat_integration(db))
