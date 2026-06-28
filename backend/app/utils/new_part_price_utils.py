from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.new_parts_seo_card import NewPartsSeoCard


def _parse_positive_price(price: float | int | str | None) -> float | None:
    if price is None:
        return None
    try:
        amount = float(price)
    except (TypeError, ValueError):
        return None
    if amount <= 0:
        return None
    return round(amount, 2)


def apply_markup_price(price: float | int | str | None, markup_percent: float) -> float | None:
    base = _parse_positive_price(price)
    if base is None:
        return None
    mult = 1.0 + float(markup_percent) / 100.0
    return round(base * mult, 2)


def min_stock_base_price(card: "NewPartsSeoCard") -> float | None:
    from app.services.new_parts_seo_card_service import _stocks_from_card

    stocks = _stocks_from_card(card)
    prices: list[float] = []
    for stock in stocks:
        parsed = _parse_positive_price(stock.get("price"))
        if parsed is not None and int(stock.get("available_count") or 0) > 0:
            prices.append(parsed)
    if prices:
        return min(prices)
    return _parse_positive_price(card.price)


def min_stock_price_with_markup(card: "NewPartsSeoCard", markup_percent: float) -> float | None:
    from app.services.new_parts_seo_card_service import _stocks_from_card

    stocks = _stocks_from_card(card)
    prices: list[float] = []
    for stock in stocks:
        marked = apply_markup_price(stock.get("price"), markup_percent)
        if marked is not None and int(stock.get("available_count") or 0) > 0:
            prices.append(marked)
    if prices:
        return min(prices)
    return apply_markup_price(card.price, markup_percent)
