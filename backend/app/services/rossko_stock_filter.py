"""Фильтрация складов Rossko: только предложения с доставкой (не самовывоз)."""
from __future__ import annotations

from typing import Any


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
