from __future__ import annotations

import logging
from typing import Any, Optional

from sqlalchemy.orm import Session
from zeep import Client
from zeep.helpers import serialize_object
from zeep.transports import Transport

from app.core.config import Settings
from app.services.laximo.doc_client import LaximoDocError, find_oem
from app.services.laximo.gate import laximo_doc_ready
from app.services.local_product_search import search_local_products_query
from app.utils.partnumber import normalize_partnumber

logger = logging.getLogger(__name__)
settings = Settings()

OEM_BATCH_CAP = 40
ANALOGS_CAP = 5
ROSSKO_DELIVERY_ID = "000000001"

_search_client = None


def _get_search_client():
    global _search_client
    if _search_client is None:
        transport = Transport()
        wsdl_url = settings.GET_SEARCH.replace("?wsdl", "").rstrip("?")
        _search_client = Client(wsdl_url + "?wsdl", transport=transport)
    return _search_client


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


def _lookup_rossko(oem: str) -> dict[str, Any]:
    empty = {"available": False, "count": 0, "min_price": None, "sample": None}
    try:
        params = {
            "KEY1": settings.ROSSKO_KEY1,
            "KEY2": settings.ROSSKO_KEY2,
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
        min_prices = [p for p in (_rossko_part_min_price(x) for x in use_parts) if p]
        stock_sum = sum(_rossko_part_stock_count(x) for x in use_parts)
        sample = use_parts[0]
        brand = sample.get("brand") or sample.get("manufacturer")
        article = sample.get("partnumber") or sample.get("article")
        return {
            "available": True,
            "count": max(stock_sum, len(use_parts)),
            "min_price": min(min_prices) if min_prices else None,
            "sample": {
                "brand": brand,
                "article": article,
            },
        }
    except Exception:
        logger.exception("ROSSKO availability lookup failed for oem=%r", oem)
        return empty


def _lookup_used(db: Session, oem: str) -> dict[str, Any]:
    empty = {"available": False, "count": 0, "sample_product_id": None}
    try:
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


def lookup_oem_availability(db: Session, oems: list[str]) -> dict[str, Any]:
    """
    Batch OEM → ROSSKO + used + DOC analogs availability.
    Soft per-item failures; never raises tech details to client.
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

    items = []
    for oem in cleaned:
        norm = normalize_partnumber(oem) or oem.upper()
        items.append(
            {
                "oem": oem,
                "normalized_oem": norm,
                "rossko": _lookup_rossko(oem),
                "used": _lookup_used(db, oem),
                "analogs": _lookup_analogs(db, oem),
            }
        )

    return {
        "ok": True,
        "reason": "ok",
        "message": None,
        "items": items,
    }
