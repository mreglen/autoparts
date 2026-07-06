"""Округление цен товаров до целых рублей (без копеек)."""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.utils.site_settings_db import get_or_create_site_settings


def round_product_price(price: float | int | str | Decimal | None) -> float | None:
    if price is None or price == "":
        return None
    amount = Decimal(str(price))
    if amount <= 0:
        return None
    return float(amount.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def round_product_prices_enabled(db: Session) -> bool:
    row = get_or_create_site_settings(db)
    return getattr(row, "round_product_prices", False) is True


def display_product_price(
    price: float | int | str | Decimal | None,
    *,
    db: Session | None = None,
    round_kopecks: bool | None = None,
) -> float | None:
    if price is None or price == "":
        return None
    enabled = round_kopecks if round_kopecks is not None else (round_product_prices_enabled(db) if db else False)
    if enabled:
        return round_product_price(price)
    try:
        return float(price)
    except (TypeError, ValueError):
        return None


def normalize_product_price_for_save(
    price: float | int | str | Decimal | None,
    *,
    db: Session,
) -> float | None:
    if price is None or price == "":
        return None
    if round_product_prices_enabled(db):
        return round_product_price(price)
    try:
        return float(price)
    except (TypeError, ValueError):
        return None
