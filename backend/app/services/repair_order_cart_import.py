from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from app.models.repair_order import RepairOrder

_TWOPLACES = Decimal("0.01")
_THREEPLACES = Decimal("0.001")


def _money(value: Decimal | int | float | str) -> Decimal:
    return Decimal(str(value)).quantize(_TWOPLACES, rounding=ROUND_HALF_UP)


def _qty(value: Decimal | int | float | str) -> Decimal:
    return Decimal(str(value)).quantize(_THREEPLACES, rounding=ROUND_HALF_UP)


def shop_part_display_name(
    *,
    title: str,
    brand: str | None = None,
    partnumber: str | None = None,
    rossko_brand: str | None = None,
    rossko_partnumber: str | None = None,
) -> str:
    chunks: list[str] = []
    for val in (
        (brand or rossko_brand or "").strip(),
        (partnumber or rossko_partnumber or "").strip(),
        (title or "").strip(),
    ):
        if val and (not chunks or val != chunks[-1]):
            chunks.append(val)
    return " ".join(chunks)[:255] or (title or "").strip()[:255]


def _derive_prices(client_price: Decimal, purchase_price: Decimal | None) -> tuple[Decimal, Decimal]:
    purchase = _money(purchase_price) if purchase_price is not None else Decimal("0.00")
    client = _money(client_price)
    if purchase > 0:
        markup = _money((client / purchase - Decimal("1")) * Decimal("100"))
        return purchase, markup
    return client, Decimal("0.00")


def _next_position(order: RepairOrder) -> int:
    if not order.shop_parts:
        return 1
    return max(part.position for part in order.shop_parts) + 1
