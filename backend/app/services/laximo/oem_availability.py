from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session
from zeep import Client
from zeep.helpers import serialize_object
from zeep.transports import Transport

from app.core.config import Settings
from app.utils.rossko_api_keys import get_rossko_api_keys
from app.models.product import Product as ProductModel
from app.services.laximo.doc_client import LaximoDocError, find_oem
from app.services.laximo.gate import laximo_doc_ready
from app.utils.partnumber import normalize_partnumber
from app.utils.search_sql import get_sql_normalize

logger = logging.getLogger(__name__)
settings = Settings()

OEM_BATCH_CAP = 40
ANALOGS_CAP = 5
ROSSKO_DELIVERY_ID = "000000001"
ROSSKO_LOOKUP_WORKERS = 6
_ROSSKO_CACHE_TTL_SEC = 300
_ROSSKO_CACHE_MAX = 512

_search_client = None
_rossko_pool: ThreadPoolExecutor | None = None
_rossko_cache: dict[str, tuple[float, dict[str, Any]]] = {}


def _get_search_client():
    global _search_client
    if _search_client is None:
        transport = Transport()
        wsdl_url = settings.GET_SEARCH.replace("?wsdl", "").rstrip("?")
        _search_client = Client(wsdl_url + "?wsdl", transport=transport)
    return _search_client


def _get_rossko_pool() -> ThreadPoolExecutor:
    global _rossko_pool
    if _rossko_pool is None:
        _rossko_pool = ThreadPoolExecutor(
            max_workers=ROSSKO_LOOKUP_WORKERS,
            thread_name_prefix="rossko-oem",
        )
    return _rossko_pool


def _as_list(value: Any) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _parse_rossko_parts(payload: Any) -> list[dict[str, Any]]:
    if not isinstance(payload, dict):
        return []
    parts_list = payload.get("PartsList") or payload.get("partsList") or {}
    if isinstance(parts_list, dict):
        parts = parts_list.get("Part") or parts_list.get("part") or []
    else:
        parts = parts_list
    return [p for p in _as_list(parts) if isinstance(p, dict)]


def _rossko_part_min_price(part: dict[str, Any]) -> Optional[float]:
    stocks = (part.get("stocks") or {}).get("stock")
    prices: list[float] = []
    for stock in _as_list(stocks):
        if not isinstance(stock, dict):
            continue
        try:
            price = float(stock.get("price") or 0)
        except (TypeError, ValueError):
            continue
        if price > 0:
            prices.append(price)
    return min(prices) if prices else None


def _rossko_part_stock_count(part: dict[str, Any]) -> int:
    stocks = (part.get("stocks") or {}).get("stock")
    total = 0
    for stock in _as_list(stocks):
        if not isinstance(stock, dict):
            continue
        try:
            total += int(stock.get("count") or 0)
        except (TypeError, ValueError):
            continue
    return total


def _empty_rossko() -> dict[str, Any]:
    return {"available": False, "count": 0, "min_price": None, "sample": None}


def _empty_used() -> dict[str, Any]:
    return {"available": False, "count": 0, "sample_product_id": None}


def _lookup_rossko(oem: str) -> dict[str, Any]:
    empty = _empty_rossko()
    try:
        key1, key2 = get_rossko_api_keys()
        params = {
            "KEY1": key1,
            "KEY2": key2,
            "text": oem,
            "delivery_id": ROSSKO_DELIVERY_ID,
        }
        raw = _get_search_client().service.GetSearch(**params)
        serialized = serialize_object(raw)
        parts = _parse_rossko_parts(serialized)
        if not parts:
            return empty
        norm = normalize_partnumber(oem)
        matched = []
        for part in parts:
            pn = normalize_partnumber(part.get("partnumber") or part.get("article"))
            if pn and (pn == norm or norm in pn or pn in norm):
                matched.append(part)
        use_parts = matched or parts
        in_stock = [part for part in use_parts if _rossko_part_stock_count(part) > 0]
        if not in_stock:
            return empty
        min_prices = [p for p in (_rossko_part_min_price(x) for x in in_stock) if p]
        stock_sum = sum(_rossko_part_stock_count(x) for x in in_stock)
        sample = in_stock[0]
        brand = sample.get("brand") or sample.get("manufacturer")
        article = sample.get("partnumber") or sample.get("article")
        return {
            "available": stock_sum > 0,
            "count": stock_sum,
            "min_price": min(min_prices) if min_prices else None,
            "sample": {
                "brand": brand,
                "article": article,
            },
        }
    except Exception:
        logger.exception("ROSSKO availability lookup failed for oem=%r", oem)
        return empty


def _lookup_rossko_cached(oem: str) -> dict[str, Any]:
    key = normalize_partnumber(oem) or oem.strip().upper()
    now = time.monotonic()
    cached = _rossko_cache.get(key)
    if cached and now - cached[0] < _ROSSKO_CACHE_TTL_SEC:
        return cached[1]

    result = _lookup_rossko(oem)
    _rossko_cache[key] = (now, result)
    if len(_rossko_cache) > _ROSSKO_CACHE_MAX:
        stale_before = now - _ROSSKO_CACHE_TTL_SEC
        for cache_key, (ts, _) in list(_rossko_cache.items()):
            if ts < stale_before:
                _rossko_cache.pop(cache_key, None)
    return result


def _lookup_rossko_many(oems: list[str]) -> dict[str, dict[str, Any]]:
    if not oems:
        return {}

    unique: list[str] = []
    seen: set[str] = set()
    for oem in oems:
        key = normalize_partnumber(oem) or oem.strip().upper()
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(oem)

    if len(unique) == 1:
        key = normalize_partnumber(unique[0]) or unique[0].strip().upper()
        return {key: _lookup_rossko_cached(unique[0])}

    out: dict[str, dict[str, Any]] = {}
    pool = _get_rossko_pool()
    futures = {pool.submit(_lookup_rossko_cached, oem): oem for oem in unique}
    for future in as_completed(futures):
        oem = futures[future]
        key = normalize_partnumber(oem) or oem.strip().upper()
        try:
            out[key] = future.result()
        except Exception:
            logger.exception("ROSSKO batch lookup failed for oem=%r", oem)
            out[key] = _empty_rossko()
    return out


def _lookup_used(db: Session, oem: str) -> dict[str, Any]:
    empty = _empty_used()
    try:
        from app.services.local_product_search import search_local_products_query

        rows = search_local_products_query(db, oem, is_new=False, limit=20).all()
        if not rows:
            return empty
        return {
            "available": True,
            "count": len(rows),
            "sample_product_id": getattr(rows[0], "id", None),
        }
    except Exception:
        logger.exception("Used availability lookup failed for oem=%r", oem)
        return empty


def _lookup_used_many(db: Session, oems: list[str]) -> dict[str, dict[str, Any]]:
    norms: list[str] = []
    seen: set[str] = set()
    for raw in oems:
        norm = normalize_partnumber(raw) or raw.strip().upper()
        if not norm or norm in seen:
            continue
        seen.add(norm)
        norms.append(norm)

    result = {norm: _empty_used() for norm in norms}
    if not norms:
        return result

    try:
        norm_expr = get_sql_normalize(ProductModel.article)
        rows = (
            db.query(ProductModel)
            .filter(
                ProductModel.is_new.is_(False),
                func.coalesce(ProductModel.quantity, 0) > 0,
                norm_expr.in_(norms),
            )
            .order_by(ProductModel.id.asc())
            .limit(max(len(norms) * 20, 100))
            .all()
        )
        counts: dict[str, int] = {}
        samples: dict[str, Optional[int]] = {}
        for row in rows:
            norm = normalize_partnumber(row.article)
            if not norm or norm not in result:
                continue
            counts[norm] = counts.get(norm, 0) + 1
            if norm not in samples:
                samples[norm] = getattr(row, "id", None)

        for norm, count in counts.items():
            result[norm] = {
                "available": True,
                "count": count,
                "sample_product_id": samples.get(norm),
            }
    except Exception:
        logger.exception("Used batch availability lookup failed")

    return result


def _empty_analogs() -> dict[str, Any]:
    return {"available": False, "count": 0, "items": []}


def _lookup_analogs(db: Session, oem: str) -> dict[str, Any]:
    """FindOEM replacements → top-N with ROSSKO/used match. Soft-fail empty."""
    if not laximo_doc_ready(db):
        return _empty_analogs()

    try:
        replacements = find_oem(db, oem, count_toward_quota=True, use_cache=True)
    except LaximoDocError:
        logger.info("DOC FindOEM soft-fail for oem=%r", oem)
        return _empty_analogs()
    except Exception:
        logger.exception("DOC FindOEM unexpected error for oem=%r", oem)
        return _empty_analogs()

    if not replacements:
        return _empty_analogs()

    source_norm = normalize_partnumber(oem) or oem.strip().upper()
    items: list[dict[str, Any]] = []
    for repl in replacements:
        if len(items) >= ANALOGS_CAP:
            break
        cross_oem = (repl.get("oem") or "").strip()
        if not cross_oem:
            continue
        cross_norm = normalize_partnumber(cross_oem) or cross_oem.upper()
        if cross_norm == source_norm:
            continue
        rossko = _lookup_rossko(cross_oem)
        used = _lookup_used(db, cross_oem)
        items.append(
            {
                "brand": repl.get("brand"),
                "oem": cross_oem,
                "name": repl.get("name"),
                "rossko": rossko,
                "used": used,
            }
        )

    if not items:
        return _empty_analogs()

    return {
        "available": True,
        "count": len(items),
        "items": items,
    }


def lookup_oem_availability(
    db: Session,
    oems: list[str],
    *,
    include_analogs: bool = False,
) -> dict[str, Any]:
    """
    Batch OEM → ROSSKO + used (+ optional DOC analogs) availability.
    Rossko lookups run in parallel; analog cross-checks are off by default for speed.
    """
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in oems or []:
        text = (raw or "").strip()
        if not text:
            continue
        key = normalize_partnumber(text) or text.upper()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(text)
        if len(cleaned) >= OEM_BATCH_CAP:
            break

    if not cleaned:
        return {
            "ok": True,
            "reason": "ok",
            "message": None,
            "items": [],
        }

    rossko_by_norm = _lookup_rossko_many(cleaned)
    used_by_norm = _lookup_used_many(db, cleaned)

    items = []
    for oem in cleaned:
        norm = normalize_partnumber(oem) or oem.upper()
        analogs = _lookup_analogs(db, oem) if include_analogs else _empty_analogs()
        items.append(
            {
                "oem": oem,
                "normalized_oem": norm,
                "rossko": rossko_by_norm.get(norm, _empty_rossko()),
                "used": used_by_norm.get(norm, _empty_used()),
                "analogs": analogs,
            }
        )

    return {
        "ok": True,
        "reason": "ok",
        "message": None,
        "items": items,
    }
