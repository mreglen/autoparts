"""Фильтрация складов Rossko: доставка + whitelist из настроек."""
from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def _safe_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float)):
        return str(value)
    return ""


def has_rossko_delivery_window(stock: dict[str, Any]) -> bool:
    start = _safe_text(stock.get("deliveryStart") or stock.get("delivery_start"))
    end = _safe_text(stock.get("deliveryEnd") or stock.get("delivery_end"))
    return bool(start and end)


def is_rossko_deliverable_stock(stock: dict[str, Any]) -> bool:
    """Склад с доставкой: у Rossko API 2.1 есть окно deliveryStart/deliveryEnd."""
    if not isinstance(stock, dict):
        return False
    return has_rossko_delivery_window(stock)


def parse_json_list(raw: object) -> list:
    if raw is None:
        return []
    if isinstance(raw, list):
        return raw
    text = str(raw).strip()
    if not text:
        return []
    try:
        data = json.loads(text)
    except (TypeError, ValueError, json.JSONDecodeError):
        return []
    return data if isinstance(data, list) else []


def parse_allowed_stock_ids(raw: object) -> frozenset[str] | None:
    """
    Returns:
      None — фильтр выключен (показывать все deliverable-склады)
      frozenset — только эти stock id
    """
    items = parse_json_list(raw)
    ids = {_safe_text(x) for x in items if _safe_text(x)}
    return frozenset(ids) if ids else None


def parse_known_stocks(raw: object) -> list[dict[str, str]]:
    items = parse_json_list(raw)
    result: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in items:
        if isinstance(item, dict):
            stock_id = _safe_text(item.get("id") or item.get("stock_id"))
            name = _safe_text(item.get("name") or item.get("description") or stock_id)
        else:
            stock_id = _safe_text(item)
            name = stock_id
        if not stock_id or stock_id in seen:
            continue
        seen.add(stock_id)
        result.append({"id": stock_id, "name": name or stock_id})
    result.sort(key=lambda row: (row["name"].casefold(), row["id"]))
    return result


def load_allowed_stock_ids(db: Session | None) -> frozenset[str] | None:
    if db is None:
        return None
    try:
        from app.utils.rossko_settings_db import get_rossko_settings

        row = get_rossko_settings(db)
        return parse_allowed_stock_ids(getattr(row, "allowed_stock_ids", None))
    except Exception:
        logger.exception("Failed to load Rossko allowed stock ids")
        return None


def load_known_stocks(db: Session | None) -> list[dict[str, str]]:
    if db is None:
        return []
    try:
        from app.utils.rossko_settings_db import get_rossko_settings

        row = get_rossko_settings(db)
        return parse_known_stocks(getattr(row, "known_stocks_json", None))
    except Exception:
        logger.exception("Failed to load Rossko known stocks")
        return []


def stock_id_of(stock: dict[str, Any]) -> str:
    return _safe_text(stock.get("id") or stock.get("stock_id"))


def stock_name_of(stock: dict[str, Any]) -> str:
    return _safe_text(stock.get("description") or stock.get("name") or stock_id_of(stock))


def is_stock_allowed(stock: dict[str, Any], allowed: frozenset[str] | None) -> bool:
    if not allowed:
        return True
    return stock_id_of(stock) in allowed


def filter_stocks_list(
    stocks: list[dict[str, Any]] | dict[str, Any] | None,
    allowed: frozenset[str] | None,
) -> list[dict[str, Any]]:
    if not stocks:
        return []
    arr = stocks if isinstance(stocks, list) else [stocks]
    out: list[dict[str, Any]] = []
    for stock in arr:
        if not isinstance(stock, dict):
            continue
        if not is_rossko_deliverable_stock(stock):
            continue
        if not is_stock_allowed(stock, allowed):
            continue
        out.append(stock)
    return out


def _filter_part_stocks_inplace(part: dict[str, Any], allowed: frozenset[str] | None) -> None:
    stocks_wrap = part.get("stocks")
    if not isinstance(stocks_wrap, dict):
        return
    filtered = filter_stocks_list(stocks_wrap.get("stock"), allowed)
    if not filtered:
        stocks_wrap["stock"] = []
    elif len(filtered) == 1:
        stocks_wrap["stock"] = filtered[0]
    else:
        stocks_wrap["stock"] = filtered


def filter_search_payload_stocks(
    data: dict[str, Any] | None,
    allowed: frozenset[str] | None,
) -> dict[str, Any] | None:
    """Filter stocks in Rossko GetSearch payload by allowlist (in-place)."""
    if not data or not allowed:
        return data

    def walk(part: dict[str, Any], *, depth: int = 0) -> None:
        if depth > 3:
            return
        _filter_part_stocks_inplace(part, allowed)
        crosses = part.get("crosses") or {}
        cross_parts = crosses.get("Part") or []
        if isinstance(cross_parts, dict):
            cross_parts = [cross_parts]
        if not isinstance(cross_parts, list):
            return
        for cross in cross_parts:
            if isinstance(cross, dict):
                walk(cross, depth=depth + 1)

    parts_list = (data.get("PartsList") or {}).get("Part")
    if isinstance(parts_list, dict):
        walk(parts_list)
    elif isinstance(parts_list, list):
        for part in parts_list:
            if isinstance(part, dict):
                walk(part)
    return data


def collect_stocks_from_payload(data: dict[str, Any] | None) -> list[dict[str, str]]:
    if not data:
        return []
    found: dict[str, str] = {}

    def walk(part: dict[str, Any], *, depth: int = 0) -> None:
        if depth > 3:
            return
        stocks_wrap = part.get("stocks") if isinstance(part, dict) else None
        if isinstance(stocks_wrap, dict):
            raw = stocks_wrap.get("stock")
            arr = raw if isinstance(raw, list) else ([raw] if raw else [])
            for stock in arr:
                if not isinstance(stock, dict) or not is_rossko_deliverable_stock(stock):
                    continue
                stock_id = stock_id_of(stock)
                if not stock_id:
                    continue
                name = stock_name_of(stock) or stock_id
                prev = found.get(stock_id)
                if not prev or (name and name != stock_id and (not prev or prev == stock_id)):
                    found[stock_id] = name
        crosses = (part.get("crosses") or {}) if isinstance(part, dict) else {}
        cross_parts = crosses.get("Part") or []
        if isinstance(cross_parts, dict):
            cross_parts = [cross_parts]
        if isinstance(cross_parts, list):
            for cross in cross_parts:
                if isinstance(cross, dict):
                    walk(cross, depth=depth + 1)

    parts_list = (data.get("PartsList") or {}).get("Part")
    if isinstance(parts_list, dict):
        walk(parts_list)
    elif isinstance(parts_list, list):
        for part in parts_list:
            if isinstance(part, dict):
                walk(part)

    rows = [{"id": sid, "name": name} for sid, name in found.items()]
    rows.sort(key=lambda row: (row["name"].casefold(), row["id"]))
    return rows


def merge_known_stocks(db: Session, stocks: list[dict[str, str]]) -> int:
    """Merge discovered warehouses into rossko_settings.known_stocks_json. Returns new count."""
    if not stocks:
        return 0
    from app.utils.rossko_settings_db import get_rossko_settings

    row = get_rossko_settings(db)
    existing = parse_known_stocks(getattr(row, "known_stocks_json", None))
    by_id = {item["id"]: item for item in existing}
    added = 0
    for stock in stocks:
        stock_id = _safe_text(stock.get("id"))
        name = _safe_text(stock.get("name") or stock_id)
        if not stock_id:
            continue
        if stock_id not in by_id:
            added += 1
            by_id[stock_id] = {"id": stock_id, "name": name or stock_id}
        elif name and name != stock_id:
            by_id[stock_id]["name"] = name
    merged = sorted(by_id.values(), key=lambda item: (item["name"].casefold(), item["id"]))
    row.known_stocks_json = json.dumps(merged, ensure_ascii=False)
    db.commit()
    return added
