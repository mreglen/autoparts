"""
Разбор цен позиций заказа Авито (логика 1:1 с frontend avitoOrderDisplay.js).
"""

from __future__ import annotations

from typing import Any, Optional


def _to_number(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def avito_line_item_qty(item: dict) -> int:
    q = item.get("count") if item.get("count") is not None else item.get("quantity")
    if q is None or q == "":
        return 1
    try:
        qty = int(q)
        return max(qty, 1)
    except (TypeError, ValueError):
        return 1


def avito_line_item_total(item: dict) -> float:
    prices = item.get("prices") or {}
    if not isinstance(prices, dict):
        prices = {}

    pt = _to_number(prices.get("total"))
    if pt is not None:
        return pt

    unit = _to_number(item.get("price"))
    if unit is None:
        unit = _to_number(prices.get("price"))
    if unit is None:
        unit = 0.0

    return unit * avito_line_item_qty(item)


def avito_line_item_unit_price(item: dict) -> float:
    qty = avito_line_item_qty(item)
    total = avito_line_item_total(item)
    if total <= 0:
        return 0.0
    return total / qty


def avito_order_items(avito_data: dict | None) -> list[dict]:
    if not avito_data or not isinstance(avito_data, dict):
        return []
    raw = avito_data.get("items") or avito_data.get("products")
    if not isinstance(raw, list):
        return []
    return [x for x in raw if isinstance(x, dict)]


def unit_price_for_stock_out(
    item: dict,
    *,
    product_price: float | None = None,
) -> float:
    """
    Цена за единицу для StockOut.sale_price (sale_price * quantity = итог строки в UI).
    """
    unit = avito_line_item_unit_price(item)
    if unit > 0:
        return unit
    if product_price is not None and product_price > 0:
        return float(product_price)
    return 0.0
