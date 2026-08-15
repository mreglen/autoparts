from __future__ import annotations

import hashlib
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from sqlalchemy.orm import Session

from app.services.laximo import cat_client
from app.services.laximo.catalog_features import (
    get_catalog_features,
    has_fulltextsearch,
    has_quickgroups,
)
from app.services.laximo.cat_client import LaximoCatError
from app.services.laximo.gate import (
    PUBLIC_OK,
    PUBLIC_TEMPORARILY_UNAVAILABLE,
    PUBLIC_UNAVAILABLE_MESSAGE,
    assert_public_message_safe,
    laximo_cat_ready,
    public_message_for_reason,
)
from app.services.laximo.snapshots import (
    KIND_CATALOG_FEATURES,
    KIND_CATEGORIES,
    KIND_IMAGE_MAP,
    KIND_QUICK_GROUP_DETAILS,
    KIND_QUICK_GROUPS,
    KIND_UNIT_DETAILS,
    KIND_UNITS,
    format_fetched_at,
    get_snapshot_payload,
    make_catalog_features_key,
    make_categories_key,
    make_image_map_key,
    make_quick_group_details_key,
    make_quick_groups_key,
    make_unit_details_key,
    make_units_key,
    try_load_snapshot_envelope_fields,
    upsert_snapshot,
)

logger = logging.getLogger(__name__)

PUBLIC_SESSION_EXPIRED = "session_expired"
PUBLIC_SESSION_MESSAGE = (
    "Сессия каталога устарела. Повторите поиск автомобиля по VIN."
)

TREE_CACHE_TTL_SEC = 3600
SEARCH_DETAILS_CAP = 40

_tree_cache: dict[str, tuple[float, Any]] = {}


@dataclass
class SoftEnvelope:
    ok: bool
    reason: str
    message: Optional[str] = None
    payload: dict[str, Any] = field(default_factory=dict)
    from_snapshot: bool = False
    snapshot_fetched_at: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        out = {
            "ok": self.ok,
            "reason": self.reason,
            "message": self.message,
            "from_snapshot": self.from_snapshot,
        }
        if self.snapshot_fetched_at is not None:
            out["snapshot_fetched_at"] = self.snapshot_fetched_at
        out.update(self.payload)
        return out


def clear_unit_tree_cache() -> None:
    _tree_cache.clear()


def _unavailable() -> SoftEnvelope:
    _, message = public_message_for_reason(PUBLIC_TEMPORARILY_UNAVAILABLE)
    assert_public_message_safe(message)
    return SoftEnvelope(
        ok=False,
        reason=PUBLIC_TEMPORARILY_UNAVAILABLE,
        message=message,
    )


def _session_expired() -> SoftEnvelope:
    assert_public_message_safe(PUBLIC_SESSION_MESSAGE)
    return SoftEnvelope(
        ok=False,
        reason=PUBLIC_SESSION_EXPIRED,
        message=PUBLIC_SESSION_MESSAGE,
    )


def _ok(**payload: Any) -> SoftEnvelope:
    return SoftEnvelope(ok=True, reason=PUBLIC_OK, message=None, payload=dict(payload))


def _ok_from_snapshot(payload: dict[str, Any], fetched_at: Any) -> SoftEnvelope:
    return SoftEnvelope(
        ok=True,
        reason=PUBLIC_OK,
        message=None,
        payload=dict(payload),
        from_snapshot=True,
        snapshot_fetched_at=format_fetched_at(fetched_at),
    )


def _try_snapshot(
    db: Session,
    kind: str,
    resource_key: str,
) -> Optional[SoftEnvelope]:
    loaded = try_load_snapshot_envelope_fields(db, kind, resource_key)
    if not loaded:
        return None
    payload, fetched_at = loaded
    return _ok_from_snapshot(payload, fetched_at)


def _persist_tree_snapshot(
    db: Session,
    *,
    kind: str,
    resource_key: str,
    payload: dict[str, Any],
    catalog: Optional[str] = None,
    vehicle_id: Optional[str] = None,
    materialize_images: bool = False,
) -> None:
    try:
        upsert_snapshot(
            db,
            kind=kind,
            resource_key=resource_key,
            payload=payload,
            catalog=catalog,
            vehicle_id=vehicle_id,
            materialize_images=materialize_images,
            commit=True,
        )
    except Exception:
        logger.exception("Failed to persist catalog snapshot kind=%s", kind)


def _norm_ctx(
    catalog: Optional[str],
    vehicle_id: Optional[str],
    ssd: Optional[str],
) -> tuple[Optional[str], Optional[str], Optional[str]]:
    c = (catalog or "").strip() or None
    v = (vehicle_id or "").strip() or None
    s = (ssd or "").strip() or None
    return c, v, s


def _require_vehicle_ctx(
    catalog: Optional[str],
    vehicle_id: Optional[str],
    ssd: Optional[str],
) -> tuple[Optional[SoftEnvelope], Optional[tuple[str, str, str]]]:
    c, v, s = _norm_ctx(catalog, vehicle_id, ssd)
    if not c or not v or not s:
        return _session_expired(), None
    return None, (c, v, s)


def _ssd_hash(ssd: str) -> str:
    return hashlib.sha256(ssd.encode("utf-8")).hexdigest()[:16]


def _cache_get(key: str) -> Any:
    entry = _tree_cache.get(key)
    if not entry:
        return None
    expires_at, value = entry
    if time.monotonic() >= expires_at:
        _tree_cache.pop(key, None)
        return None
    return value


def _cache_set(key: str, value: Any) -> None:
    _tree_cache[key] = (time.monotonic() + TREE_CACHE_TTL_SEC, value)


def _pick(row: dict[str, Any], *keys: str) -> Any:
    lower_map = {str(k).lower(): v for k, v in row.items()}
    for key in keys:
        if key in row and row[key] is not None:
            return row[key]
        lk = key.lower()
        if lk in lower_map and lower_map[lk] is not None:
            return lower_map[lk]
    return None


def _str_or_none(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _boolish(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in ("1", "true", "yes", "y")


def resolve_laximo_image_url(url: Optional[str], *, size: str = "source") -> Optional[str]:
    """Replace Laximo %size% placeholder. Prefer 'source' for full quality."""
    text = _str_or_none(url)
    if not text:
        return None
    if "%size%" in text:
        return text.replace("%size%", size or "source")
    return text


def _pick_unit_image(row: dict[str, Any]) -> Optional[str]:
    return resolve_laximo_image_url(
        _str_or_none(
            _pick(
                row,
                "largeImageUrl",
                "largeimageurl",
                "imageUrl",
                "imageurl",
                "image",
            )
        )
    )


def normalize_category(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "category_id": _str_or_none(_pick(row, "categoryId", "categoryid", "id")),
        "code": _str_or_none(_pick(row, "code")),
        "name": _str_or_none(_pick(row, "name")),
        "parent_category_id": _str_or_none(
            _pick(row, "parentCategoryId", "parentcategoryid", "parent_category_id")
        ),
        "ssd": _str_or_none(_pick(row, "ssd")),
        "has_children": _boolish(_pick(row, "childrens", "children", "hasChildren")),
    }


def normalize_unit(row: dict[str, Any]) -> dict[str, Any]:
    filter_raw = _pick(row, "filter")
    filter_text = None
    if filter_raw is not None and filter_raw is not False:
        filter_text = str(filter_raw).strip() or None
    return {
        "unit_id": _str_or_none(_pick(row, "unitId", "unitid", "id")),
        "code": _str_or_none(_pick(row, "code")),
        "name": _str_or_none(_pick(row, "name")),
        "ssd": _str_or_none(_pick(row, "ssd")),
        "image_url": _pick_unit_image(row),
        "filter": filter_text,
    }


def normalize_detail(row: dict[str, Any]) -> dict[str, Any]:
    oem = _str_or_none(_pick(row, "oem", "OEM", "partNumber", "partnumber"))
    detail_id = _str_or_none(_pick(row, "detailId", "detailid", "id")) or oem
    filter_raw = _pick(row, "filter")
    filter_text = None
    if filter_raw is not None and filter_raw is not False:
        filter_text = str(filter_raw).strip() or None
    return {
        "oem": oem,
        "name": _str_or_none(_pick(row, "name")),
        "code_on_image": _str_or_none(
            _pick(row, "codeOnImage", "codeonimage", "code_on_image")
        ),
        "ssd": _str_or_none(_pick(row, "ssd")),
        "detail_id": detail_id,
        "filter": filter_text,
        "match": _pick(row, "match"),
    }


def normalize_image_map(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "code_on_image": _str_or_none(
            _pick(row, "codeOnImage", "codeonimage", "code")
        ),
        "ssd": _str_or_none(_pick(row, "ssd")),
        "x1": _pick(row, "x1"),
        "y1": _pick(row, "y1"),
        "x2": _pick(row, "x2"),
        "y2": _pick(row, "y2"),
    }


def normalize_quick_group(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "quick_group_id": _str_or_none(
            _pick(row, "quickGroupId", "quickgroupid", "id", "groupId")
        ),
        "name": _str_or_none(_pick(row, "name")),
        "ssd": _str_or_none(_pick(row, "ssd")),
        "link": _boolish(_pick(row, "link")),
        "parent_id": _str_or_none(_pick(row, "parentId", "parentid", "parent_id")),
        "synonyms": _str_or_none(_pick(row, "synonyms")),
    }


def _quick_group_roots(data: Any) -> list[dict[str, Any]]:
    if data is None:
        return []
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if isinstance(data, dict):
        for key in ("quickGroups", "groups", "rows", "items", "data"):
            nested = data.get(key)
            if isinstance(nested, list):
                return [item for item in nested if isinstance(item, dict)]
        return [data]
    return []


def flatten_quick_groups(data: Any) -> list[dict[str, Any]]:
    """Flatten nested ListQuickGroup tree into rows with parent_id."""
    return _flatten_quick_group_nodes(_quick_group_roots(data), parent_id="")


def _flatten_quick_group_nodes(
    nodes: list[dict[str, Any]],
    *,
    parent_id: str,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for node in nodes:
        if not isinstance(node, dict):
            continue
        qid = (
            _str_or_none(_pick(node, "quickGroupId", "quickgroupid", "id", "groupId"))
            or ""
        )
        row = normalize_quick_group(node)
        row["parent_id"] = parent_id or None
        out.append(row)
        children = node.get("children")
        if isinstance(children, list) and children:
            child_nodes = [c for c in children if isinstance(c, dict)]
            out.extend(_flatten_quick_group_nodes(child_nodes, parent_id=qid))
    return out


def _quick_detail_categories(data: Any) -> list[dict[str, Any]]:
    if data is None:
        return []
    if isinstance(data, list):
        cats: list[dict[str, Any]] = []
        for item in data:
            if not isinstance(item, dict):
                continue
            if isinstance(item.get("units"), list):
                cats.append(item)
            elif _pick(item, "categoryId", "categoryid"):
                cats.append(item)
        return cats or [item for item in data if isinstance(item, dict)]
    if isinstance(data, dict):
        for key in ("categories", "rows", "items", "data"):
            nested = data.get(key)
            if isinstance(nested, list):
                return [item for item in nested if isinstance(item, dict)]
        if isinstance(data.get("units"), list):
            return [data]
        return [data]
    return []


def _quick_detail_flat_rows(data: Any) -> list[dict[str, Any]]:
    if data is None:
        return []
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if isinstance(data, dict):
        for key in ("details", "units", "rows", "items", "data", "quickDetails"):
            nested = data.get(key)
            if isinstance(nested, list):
                return [item for item in nested if isinstance(item, dict)]
    return []


def parse_quick_detail_response(
    data: Any,
) -> tuple[Optional[dict[str, Any]], list[dict[str, Any]]]:
    """Extract unit info and detail rows from ListQuickDetail response."""
    primary_unit: Optional[dict[str, Any]] = None
    matched_unit: Optional[dict[str, Any]] = None
    details: list[dict[str, Any]] = []
    seen: set[str] = set()

    def _append_detail(item: dict[str, Any]) -> None:
        row = normalize_detail(item)
        key = "|".join(
            [
                str(row.get("oem") or ""),
                str(row.get("code_on_image") or ""),
                str(row.get("name") or ""),
                str(row.get("detail_id") or ""),
            ]
        )
        if key in seen:
            return
        seen.add(key)
        details.append(row)

    for cat in _quick_detail_categories(data):
        units = cat.get("units")
        if not isinstance(units, list):
            continue
        for unit in units:
            if not isinstance(unit, dict):
                continue
            unit_norm = normalize_unit_info(unit)
            if primary_unit is None:
                primary_unit = unit_norm
            unit_details = unit.get("details")
            has_match = False
            if isinstance(unit_details, list):
                for item in unit_details:
                    if not isinstance(item, dict):
                        continue
                    _append_detail(item)
                    match_raw = item.get("match")
                    if match_raw is True or str(match_raw).lower() in ("t", "true", "1"):
                        has_match = True
            if has_match and matched_unit is None:
                matched_unit = unit_norm

    if details:
        # Prefer unit that contains match=true details (better schema for the group).
        details.sort(
            key=lambda d: (
                0
                if d.get("match") is True
                or str(d.get("match") or "").lower() in ("t", "true", "1")
                else 1,
                str(d.get("code_on_image") or ""),
                str(d.get("name") or ""),
            )
        )
        return matched_unit or primary_unit, details

    for row in _quick_detail_flat_rows(data):
        if _pick(row, "oem", "OEM", "partNumber", "partnumber"):
            _append_detail(row)
        elif _pick(row, "unitId", "unitid", "id") and _pick(row, "name"):
            if primary_unit is None:
                primary_unit = normalize_unit_info(row)

    return primary_unit, details


def normalize_unit_info(row: dict[str, Any]) -> dict[str, Any]:
    filter_raw = _pick(row, "filter")
    filter_text = None
    if filter_raw is not None and filter_raw is not False:
        filter_text = str(filter_raw).strip() or None
    return {
        "unit_id": _str_or_none(_pick(row, "unitId", "unitid", "id")),
        "code": _str_or_none(_pick(row, "code")),
        "name": _str_or_none(_pick(row, "name")),
        "ssd": _str_or_none(_pick(row, "ssd")),
        "image_url": _pick_unit_image(row),
        "filter": filter_text,
    }


def _require_vehicle_identity(
    catalog: Optional[str],
    vehicle_id: Optional[str],
) -> tuple[Optional[SoftEnvelope], Optional[tuple[str, str]]]:
    c, v, _ = _norm_ctx(catalog, vehicle_id, None)
    if not c or not v:
        return _session_expired(), None
    return None, (c, v)


def _execute(
    db: Session,
    *,
    cache_key: Optional[str],
    call: Callable[[], Any],
    build_payload: Callable[[Any], dict[str, Any]],
    snapshot_kind: Optional[str] = None,
    snapshot_key: Optional[str] = None,
    snapshot_catalog: Optional[str] = None,
    snapshot_vehicle_id: Optional[str] = None,
    materialize_images: bool = False,
) -> SoftEnvelope:
    ready = laximo_cat_ready(db)

    if not ready:
        if snapshot_kind and snapshot_key:
            snap = _try_snapshot(db, snapshot_kind, snapshot_key)
            if snap is not None:
                return snap
        return _unavailable()

    if cache_key:
        cached = _cache_get(cache_key)
        if cached is not None:
            return _ok(**cached)

    try:
        raw = call()
    except LaximoCatError:
        logger.exception("Laximo catalog call failed")
        if snapshot_kind and snapshot_key:
            snap = _try_snapshot(db, snapshot_kind, snapshot_key)
            if snap is not None:
                return snap
        return _unavailable()
    except Exception:
        logger.exception("Unexpected Laximo catalog error")
        if snapshot_kind and snapshot_key:
            snap = _try_snapshot(db, snapshot_kind, snapshot_key)
            if snap is not None:
                return snap
        return _unavailable()

    payload = build_payload(raw)
    if cache_key:
        _cache_set(cache_key, payload)
    if snapshot_kind and snapshot_key:
        _persist_tree_snapshot(
            db,
            kind=snapshot_kind,
            resource_key=snapshot_key,
            payload=payload,
            catalog=snapshot_catalog,
            vehicle_id=snapshot_vehicle_id,
            materialize_images=materialize_images,
        )
        if materialize_images:
            loaded = get_snapshot_payload(db, snapshot_kind, snapshot_key)
            if loaded:
                stored_payload, _ = loaded
                return _ok(**stored_payload)
    return _ok(**payload)


def get_features(db: Session, catalog: str) -> SoftEnvelope:
    code = (catalog or "").strip()
    if not code:
        return _session_expired()
    snap_key = make_catalog_features_key(code)

    if not laximo_cat_ready(db):
        snap = _try_snapshot(db, KIND_CATALOG_FEATURES, snap_key)
        if snap is not None:
            return snap
        return _unavailable()

    try:
        features = sorted(get_catalog_features(db, code))
        qg = "quickgroups" in features
        fts = "fulltextsearch" in features
    except LaximoCatError:
        logger.exception("Failed to load catalog features")
        snap = _try_snapshot(db, KIND_CATALOG_FEATURES, snap_key)
        if snap is not None:
            return snap
        return _unavailable()
    except Exception:
        logger.exception("Unexpected features error")
        snap = _try_snapshot(db, KIND_CATALOG_FEATURES, snap_key)
        if snap is not None:
            return snap
        return _unavailable()

    payload = {
        "features": features,
        "has_quickgroups": qg,
        "has_fulltextsearch": fts,
        "catalog": code,
    }
    _persist_tree_snapshot(
        db,
        kind=KIND_CATALOG_FEATURES,
        resource_key=snap_key,
        payload=payload,
        catalog=code,
    )
    return _ok(**payload)


def get_categories(
    db: Session,
    *,
    catalog: str,
    vehicle_id: str,
    ssd: str,
    category_id: str = "-1",
) -> SoftEnvelope:
    err, ident = _require_vehicle_identity(catalog, vehicle_id)
    if err:
        return err
    c, v = ident  # type: ignore[misc]
    cat_id = (category_id or "-1").strip() or "-1"
    snap_key = make_categories_key(c, v, cat_id)
    _, _, s = _norm_ctx(catalog, vehicle_id, ssd)

    if not laximo_cat_ready(db) or not s:
        snap = _try_snapshot(db, KIND_CATEGORIES, snap_key)
        if snap is not None:
            return snap
        if not s:
            return _session_expired()
        return _unavailable()

    cache_key = f"cat:{c}:{v}:{_ssd_hash(s)}:{cat_id}"

    def call():
        return cat_client.list_categories(
            db,
            catalog=c,
            vehicle_id=v,
            ssd=s,
            category_id=cat_id,
            count_toward_quota=True,
        )

    return _execute(
        db,
        cache_key=cache_key,
        call=call,
        build_payload=lambda rows: {
            "categories": [normalize_category(r) for r in rows],
            "category_id": cat_id,
        },
        snapshot_kind=KIND_CATEGORIES,
        snapshot_key=snap_key,
        snapshot_catalog=c,
        snapshot_vehicle_id=v,
    )


def get_units(
    db: Session,
    *,
    catalog: str,
    vehicle_id: str,
    ssd: str,
    category_id: str,
) -> SoftEnvelope:
    err, ident = _require_vehicle_identity(catalog, vehicle_id)
    if err:
        return err
    c, v = ident  # type: ignore[misc]
    cat_id = (category_id or "").strip()
    if not cat_id:
        return _session_expired()
    snap_key = make_units_key(c, v, cat_id)
    _, _, s = _norm_ctx(catalog, vehicle_id, ssd)

    if not laximo_cat_ready(db) or not s:
        snap = _try_snapshot(db, KIND_UNITS, snap_key)
        if snap is not None:
            return snap
        if not s:
            return _session_expired()
        return _unavailable()

    cache_key = f"units:{c}:{v}:{_ssd_hash(s)}:{cat_id}"

    def call():
        return cat_client.list_units(
            db,
            catalog=c,
            vehicle_id=v,
            ssd=s,
            category_id=cat_id,
            count_toward_quota=True,
        )

    return _execute(
        db,
        cache_key=cache_key,
        call=call,
        build_payload=lambda rows: {
            "units": [normalize_unit(r) for r in rows],
            "category_id": cat_id,
        },
        snapshot_kind=KIND_UNITS,
        snapshot_key=snap_key,
        snapshot_catalog=c,
        snapshot_vehicle_id=v,
        materialize_images=True,
    )


def get_unit_with_details(
    db: Session,
    *,
    catalog: str,
    vehicle_id: str,
    ssd: str,
    unit_id: str,
) -> SoftEnvelope:
    err, ident = _require_vehicle_identity(catalog, vehicle_id)
    if err:
        return err
    c, v = ident  # type: ignore[misc]
    uid = (unit_id or "").strip()
    if not uid:
        return _session_expired()
    snap_key = make_unit_details_key(c, v, uid)
    _, _, s = _norm_ctx(catalog, vehicle_id, ssd)

    if not laximo_cat_ready(db) or not s:
        snap = _try_snapshot(db, KIND_UNIT_DETAILS, snap_key)
        if snap is not None:
            return snap
        if not s:
            return _session_expired()
        return _unavailable()

    cache_key = f"unit:{c}:{v}:{_ssd_hash(s)}:{uid}"

    def call():
        info_rows = cat_client.get_unit_info(
            db,
            catalog=c,
            vehicle_id=v,
            ssd=s,
            unit_id=uid,
            count_toward_quota=True,
        )
        detail_rows = cat_client.list_detail_by_unit(
            db,
            catalog=c,
            vehicle_id=v,
            ssd=s,
            unit_id=uid,
            count_toward_quota=True,
        )
        return info_rows, detail_rows

    def build(raw):
        info_rows, detail_rows = raw
        info = normalize_unit_info(info_rows[0]) if info_rows else {"unit_id": uid}
        return {
            "unit": info,
            "details": [normalize_detail(r) for r in detail_rows],
        }

    return _execute(
        db,
        cache_key=cache_key,
        call=call,
        build_payload=build,
        snapshot_kind=KIND_UNIT_DETAILS,
        snapshot_key=snap_key,
        snapshot_catalog=c,
        snapshot_vehicle_id=v,
        materialize_images=True,
    )


def get_unit_image_map(
    db: Session,
    *,
    catalog: str,
    vehicle_id: str,
    ssd: str,
    unit_id: str,
) -> SoftEnvelope:
    err, ident = _require_vehicle_identity(catalog, vehicle_id)
    if err:
        return err
    c, v = ident  # type: ignore[misc]
    uid = (unit_id or "").strip()
    if not uid:
        return _session_expired()
    snap_key = make_image_map_key(c, v, uid)
    _, _, s = _norm_ctx(catalog, vehicle_id, ssd)

    if not laximo_cat_ready(db) or not s:
        snap = _try_snapshot(db, KIND_IMAGE_MAP, snap_key)
        if snap is not None:
            return snap
        if not s:
            return _session_expired()
        return _unavailable()

    cache_key = f"imap:{c}:{v}:{_ssd_hash(s)}:{uid}"

    def call():
        return cat_client.list_image_map_by_unit(
            db,
            catalog=c,
            vehicle_id=v,
            ssd=s,
            unit_id=uid,
            count_toward_quota=True,
        )

    return _execute(
        db,
        cache_key=cache_key,
        call=call,
        build_payload=lambda rows: {
            "image_map": [normalize_image_map(r) for r in rows],
            "unit_id": uid,
        },
        snapshot_kind=KIND_IMAGE_MAP,
        snapshot_key=snap_key,
        snapshot_catalog=c,
        snapshot_vehicle_id=v,
    )


def get_quick_groups(
    db: Session,
    *,
    catalog: str,
    vehicle_id: str,
    ssd: str,
) -> SoftEnvelope:
    err, ident = _require_vehicle_identity(catalog, vehicle_id)
    if err:
        return err
    c, v = ident  # type: ignore[misc]
    snap_key = make_quick_groups_key(c, v)
    _, _, s = _norm_ctx(catalog, vehicle_id, ssd)

    if not laximo_cat_ready(db) or not s:
        snap = _try_snapshot(db, KIND_QUICK_GROUPS, snap_key)
        if snap is not None:
            return snap
        if not s:
            return _session_expired()
        return _unavailable()

    try:
        qg = has_quickgroups(db, c)
    except LaximoCatError:
        snap = _try_snapshot(db, KIND_QUICK_GROUPS, snap_key)
        if snap is not None:
            return snap
        return _unavailable()

    if not qg:
        payload = {"quick_groups": [], "has_quickgroups": False}
        _persist_tree_snapshot(
            db,
            kind=KIND_QUICK_GROUPS,
            resource_key=snap_key,
            payload=payload,
            catalog=c,
            vehicle_id=v,
        )
        return _ok(**payload)

    cache_key = f"qg:{c}:{v}:{_ssd_hash(s)}"

    def call():
        return cat_client.list_quick_group(
            db,
            catalog=c,
            vehicle_id=v,
            ssd=s,
            count_toward_quota=True,
        )

    return _execute(
        db,
        cache_key=cache_key,
        call=call,
        build_payload=lambda rows: {
            "quick_groups": flatten_quick_groups(rows),
            "has_quickgroups": True,
        },
        snapshot_kind=KIND_QUICK_GROUPS,
        snapshot_key=snap_key,
        snapshot_catalog=c,
        snapshot_vehicle_id=v,
    )


def get_quick_group_details(
    db: Session,
    *,
    catalog: str,
    vehicle_id: str,
    ssd: str,
    quick_group_id: str,
) -> SoftEnvelope:
    err, ident = _require_vehicle_identity(catalog, vehicle_id)
    if err:
        return err
    c, v = ident  # type: ignore[misc]
    qid = (quick_group_id or "").strip()
    if not qid:
        return _session_expired()
    snap_key = make_quick_group_details_key(c, v, qid)
    _, _, s = _norm_ctx(catalog, vehicle_id, ssd)

    if not laximo_cat_ready(db) or not s:
        snap = _try_snapshot(db, KIND_QUICK_GROUP_DETAILS, snap_key)
        if snap is not None:
            return snap
        if not s:
            return _session_expired()
        return _unavailable()

    cache_key = f"qgd:{c}:{v}:{_ssd_hash(s)}:{qid}"

    def call():
        return cat_client.list_quick_detail(
            db,
            catalog=c,
            vehicle_id=v,
            ssd=s,
            quick_group_id=qid,
            all_details=True,
            count_toward_quota=True,
        )

    def build(raw: Any) -> dict[str, Any]:
        unit, detail_rows = parse_quick_detail_response(raw)
        payload: dict[str, Any] = {
            "details": detail_rows,
            "quick_group_id": qid,
        }
        if unit:
            payload["unit"] = unit
        return payload

    return _execute(
        db,
        cache_key=cache_key,
        call=call,
        build_payload=build,
        snapshot_kind=KIND_QUICK_GROUP_DETAILS,
        snapshot_key=snap_key,
        snapshot_catalog=c,
        snapshot_vehicle_id=v,
        materialize_images=True,
    )


def search_details(
    db: Session,
    *,
    catalog: str,
    vehicle_id: str,
    ssd: str,
    query: str,
) -> SoftEnvelope:
    """SearchVehicleDetails within a vehicle. Soft-fail; no feature → empty list."""
    if not laximo_cat_ready(db):
        return _unavailable()

    err, ctx = _require_vehicle_ctx(catalog, vehicle_id, ssd)
    if err:
        return err
    c, v, s = ctx  # type: ignore[misc]
    q = (query or "").strip()
    if not q:
        return SoftEnvelope(
            ok=False,
            reason=PUBLIC_TEMPORARILY_UNAVAILABLE,
            message="Укажите название детали для поиска",
        )

    try:
        fts = has_fulltextsearch(db, c)
    except LaximoCatError:
        return _unavailable()
    except Exception:
        logger.exception("Unexpected features error for fulltextsearch")
        return _unavailable()

    if not fts:
        return _ok(
            details=[],
            query=q,
            has_fulltextsearch=False,
        )

    query_norm = q.casefold()
    cache_key = f"svd:{c}:{v}:{query_norm}"

    def call():
        return cat_client.search_vehicle_details(
            db,
            catalog=c,
            vehicle_id=v,
            ssd=s,
            query=q,
            count_toward_quota=True,
        )

    def build_payload(rows: list[dict[str, Any]]) -> dict[str, Any]:
        details = []
        seen: set[str] = set()
        for row in rows:
            oem = (row.get("oem") or "").strip()
            if not oem:
                continue
            key = oem.upper()
            if key in seen:
                continue
            seen.add(key)
            details.append(
                {
                    "oem": oem,
                    "name": (row.get("name") or None),
                }
            )
            if len(details) >= SEARCH_DETAILS_CAP:
                break
        return {
            "details": details,
            "query": q,
            "has_fulltextsearch": True,
        }

    return _execute(
        db,
        cache_key=cache_key,
        call=call,
        build_payload=build_payload,
    )


def _normalize_filter_code(filter_code: Optional[str]) -> Optional[str]:
    if filter_code is None or filter_code is False:
        return None
    text = str(filter_code).strip()
    return text or None


def get_unit_filters(
    db: Session,
    *,
    catalog: str,
    vehicle_id: str,
    ssd: str,
    unit_id: str,
    filter_code: str,
) -> SoftEnvelope:
    if not laximo_cat_ready(db):
        return _unavailable()

    err, ctx = _require_vehicle_ctx(catalog, vehicle_id, ssd)
    if err:
        return err
    c, v, s = ctx  # type: ignore[misc]
    uid = (unit_id or "").strip()
    fcode = _normalize_filter_code(filter_code)
    if not uid or not fcode:
        return _session_expired()

    cache_key = f"fbu:{c}:{v}:{uid}:{fcode}:{_ssd_hash(s)}"

    def call():
        return cat_client.get_filter_by_unit(
            db,
            catalog=c,
            vehicle_id=v,
            ssd=s,
            unit_id=uid,
            filter_code=fcode,
            count_toward_quota=True,
        )

    def build_payload(conditions: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "filter": fcode,
            "unit_id": uid,
            "conditions": conditions,
        }

    return _execute(db, cache_key=cache_key, call=call, build_payload=build_payload)


def get_detail_filters(
    db: Session,
    *,
    catalog: str,
    vehicle_id: str,
    ssd: str,
    unit_id: str,
    detail_id: str,
    filter_code: str,
) -> SoftEnvelope:
    if not laximo_cat_ready(db):
        return _unavailable()

    err, ctx = _require_vehicle_ctx(catalog, vehicle_id, ssd)
    if err:
        return err
    c, v, s = ctx  # type: ignore[misc]
    uid = (unit_id or "").strip()
    did = (detail_id or "").strip()
    fcode = _normalize_filter_code(filter_code)
    if not uid or not did or not fcode:
        return _session_expired()

    cache_key = f"fbd:{c}:{v}:{uid}:{did}:{fcode}:{_ssd_hash(s)}"

    def call():
        return cat_client.get_filter_by_detail(
            db,
            catalog=c,
            vehicle_id=v,
            ssd=s,
            unit_id=uid,
            detail_id=did,
            filter_code=fcode,
            count_toward_quota=True,
        )

    def build_payload(conditions: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "filter": fcode,
            "unit_id": uid,
            "detail_id": did,
            "conditions": conditions,
        }

    return _execute(db, cache_key=cache_key, call=call, build_payload=build_payload)


def apply_filter_ssd(
    *,
    ssd: str,
    ssd_modification: str,
    value: Optional[str] = None,
) -> SoftEnvelope:
    """Append ssdModification to ssd. If value set, replace $ in modification first."""
    base = (ssd or "").strip()
    mod = (ssd_modification or "").strip()
    if not base or not mod:
        return SoftEnvelope(
            ok=False,
            reason=PUBLIC_SESSION_EXPIRED,
            message=PUBLIC_SESSION_MESSAGE,
        )
    val = None if value is None else str(value).strip()
    if val:
        mod = mod.replace("$", val)
    return _ok(ssd=base + mod)


# Silence unused import warning helpers used in tests via package
__all__ = [
    "SoftEnvelope",
    "PUBLIC_SESSION_EXPIRED",
    "PUBLIC_SESSION_MESSAGE",
    "clear_unit_tree_cache",
    "get_features",
    "get_categories",
    "get_units",
    "get_unit_with_details",
    "get_unit_image_map",
    "get_quick_groups",
    "get_quick_group_details",
    "search_details",
    "get_unit_filters",
    "get_detail_filters",
    "apply_filter_ssd",
    "normalize_category",
    "normalize_unit",
    "normalize_detail",
    "resolve_laximo_image_url",
    "flatten_quick_groups",
    "parse_quick_detail_response",
]
