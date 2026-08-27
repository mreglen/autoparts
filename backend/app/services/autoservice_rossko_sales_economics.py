"""Pure economics helpers for Rossko marketplace sales report."""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

SITE_SHARE = Decimal("0.07")
MONEY_QUANT = Decimal("0.01")


def _money(value: Decimal | float | int | None) -> Decimal:
    if value is None:
        return Decimal("0.00")
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return value.quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def compute_order_economics(
    *,
    sale_total: Decimal,
    supplier_total: Decimal,
    acquiring_fee: Decimal | None,
    refund_amount: Decimal,
) -> dict[str, Decimal | None | bool]:
    sale = _money(sale_total)
    supplier = _money(supplier_total)
    refund = _money(refund_amount)
    fee = _money(acquiring_fee) if acquiring_fee is not None else None

    pending_acquiring = sale > 0 and fee is None
    if pending_acquiring:
        return {
            "sale_total": sale,
            "supplier_total": supplier,
            "acquiring_fee": None,
            "refund_amount": refund,
            "margin": None,
            "site_income": None,
            "organization_income": None,
            "pending_acquiring": True,
        }

    fee_value = fee or Decimal("0.00")
    margin = sale - refund - supplier - fee_value
    margin = _money(margin)
    if margin > 0:
        site_income = _money(margin * SITE_SHARE)
        organization_income = _money(margin - site_income)
    else:
        site_income = Decimal("0.00")
        organization_income = margin

    return {
        "sale_total": sale,
        "supplier_total": supplier,
        "acquiring_fee": fee_value,
        "refund_amount": refund,
        "margin": margin,
        "site_income": site_income,
        "organization_income": organization_income,
        "pending_acquiring": False,
    }


def compute_line_economics(
    *,
    quantity: int,
    sale_unit_price: Decimal,
    supplier_unit_price: Decimal,
    acquiring_fee_total: Decimal | None,
    sale_order_total: Decimal,
    refund_amount: Decimal,
    order_sale_total: Decimal,
) -> dict[str, Decimal | None | bool]:
    qty = max(int(quantity or 0), 0)
    line_sale = _money(sale_unit_price) * qty
    line_supplier = _money(supplier_unit_price) * qty

    line_refund = Decimal("0.00")
    if order_sale_total > 0 and refund_amount > 0:
        line_refund = _money(refund_amount * (line_sale / order_sale_total))

    line_fee: Decimal | None = None
    if acquiring_fee_total is not None and sale_order_total > 0:
        line_fee = _money(acquiring_fee_total * (line_sale / sale_order_total))

    economics = compute_order_economics(
        sale_total=line_sale,
        supplier_total=line_supplier,
        acquiring_fee=line_fee,
        refund_amount=line_refund,
    )
    economics["line_sale"] = line_sale
    economics["line_supplier"] = line_supplier
    economics["line_refund"] = line_refund
    return economics
