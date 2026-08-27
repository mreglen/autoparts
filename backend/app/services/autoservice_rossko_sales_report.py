"""Report: Rossko marketplace sales economics for admin-director organizations."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timezone
from decimal import Decimal

from sqlalchemy.orm import Session, selectinload

from app.models.garage_new_orders import GarageNewOrder, GarageNewOrderItem
from app.models.yookassa_payment import YookassaPayment
from app.services.autoservice_rossko_sales_economics import compute_line_economics, compute_order_economics


def _money(value: Decimal | float | int | None) -> Decimal:
    if value is None:
        return Decimal("0.00")
    if not isinstance(value, Decimal):
        return Decimal(str(value))
    return value.quantize(Decimal("0.01"))


PAYMENT_METHOD_LABELS = {
    "sbp": "СБП",
    "bank_card": "Банковская карта",
    "unpaid": "Без оплаты",
}


@dataclass
class RosskoSalesReportFilters:
    date_from: date
    date_to: date
    q: str | None = None


def _period_bounds(date_from: date, date_to: date) -> tuple[datetime, datetime]:
    start = datetime.combine(date_from, time.min, tzinfo=timezone.utc)
    end = datetime.combine(date_to, time.max, tzinfo=timezone.utc)
    return start, end


def _order_has_supplier_snapshot(order: GarageNewOrder) -> bool:
    items = order.items or []
    if not items:
        return False
    return any(item.supplier_unit_price is not None for item in items)


def _load_payment_map(db: Session, orders: list[GarageNewOrder]) -> dict[str, YookassaPayment]:
    payment_ids = {order.yookassa_payment_id for order in orders if order.yookassa_payment_id}
    session_ids = {order.checkout_session_id for order in orders if order.checkout_session_id}
    if not payment_ids and not session_ids:
        return {}

    query = db.query(YookassaPayment)
    rows: list[YookassaPayment] = []
    if payment_ids:
        rows.extend(
            query.filter(YookassaPayment.yookassa_payment_id.in_(payment_ids)).all()
        )
    if session_ids:
        rows.extend(query.filter(YookassaPayment.session_id.in_(session_ids)).all())

    mapped: dict[str, YookassaPayment] = {}
    for row in rows:
        if row.yookassa_payment_id:
            mapped[row.yookassa_payment_id] = row
        mapped[f"session:{row.session_id}"] = row
    return mapped


def _resolve_payment(order: GarageNewOrder, payment_map: dict[str, YookassaPayment]) -> YookassaPayment | None:
    if order.yookassa_payment_id and order.yookassa_payment_id in payment_map:
        return payment_map[order.yookassa_payment_id]
    if order.checkout_session_id:
        return payment_map.get(f"session:{order.checkout_session_id}")
    return None


def _recognition_datetime(order: GarageNewOrder, payment: YookassaPayment | None) -> datetime | None:
    if payment and payment.status == "succeeded" and payment.paid_at:
        return payment.paid_at
    if payment and payment.status == "succeeded":
        return payment.updated_at or payment.created_at
    if not order.is_paid and order.rossko_order_id:
        return order.created_at
    return None


def _payment_method(order: GarageNewOrder, payment: YookassaPayment | None) -> str:
    if payment and payment.payment_method_type:
        return payment.payment_method_type
    if order.is_paid:
        return "bank_card"
    return "unpaid"


def _matches_search(order: GarageNewOrder, query: str | None) -> bool:
    if not query:
        return True
    needle = query.strip().casefold()
    if not needle:
        return True
    haystacks = [
        str(order.id),
        order.rossko_order_id or "",
        order.buyer_name or "",
        order.buyer_phone or "",
        order.buyer_email or "",
    ]
    for item in order.items or []:
        haystacks.extend(
            [
                item.name or "",
                item.brand or "",
                item.partnumber or "",
            ]
        )
    return any(needle in value.casefold() for value in haystacks if value)


def _build_order_row(order: GarageNewOrder, payment: YookassaPayment | None) -> dict:
    items = [item for item in (order.items or []) if item.supplier_unit_price is not None]
    sale_total = sum(_money(item.price) * int(item.quantity or 0) for item in items)
    supplier_total = sum(_money(item.supplier_unit_price) * int(item.quantity or 0) for item in items)

    refund_amount = Decimal("0.00")
    refund_at = None
    if payment and payment.refund_status == "succeeded":
        refund_amount = _money(payment.refund_amount or payment.amount_value)
        refund_at = payment.refunded_at

    acquiring_fee = None
    if payment and payment.status == "succeeded":
        if payment.acquiring_fee_amount is not None:
            acquiring_fee = _money(payment.acquiring_fee_amount)
        elif payment.income_amount is not None:
            acquiring_fee = _money(max(Decimal("0.00"), _money(payment.amount_value) - _money(payment.income_amount)))
    elif not order.is_paid:
        acquiring_fee = Decimal("0.00")

    economics = compute_order_economics(
        sale_total=sale_total,
        supplier_total=supplier_total,
        acquiring_fee=acquiring_fee,
        refund_amount=refund_amount,
    )

    recognition_at = _recognition_datetime(order, payment)
    method = _payment_method(order, payment)
    line_items = []
    for item in items:
        line = compute_line_economics(
            quantity=int(item.quantity or 0),
            sale_unit_price=_money(item.price),
            supplier_unit_price=_money(item.supplier_unit_price),
            acquiring_fee_total=acquiring_fee,
            sale_order_total=sale_total,
            refund_amount=refund_amount,
            order_sale_total=sale_total,
        )
        line_items.append(
            {
                "item_id": item.id,
                "brand": item.brand or "",
                "partnumber": item.partnumber or "",
                "name": item.name or "",
                "quantity": int(item.quantity or 0),
                "sale_unit_price": _money(item.price),
                "supplier_unit_price": _money(item.supplier_unit_price),
                "sale_total": line["line_sale"],
                "supplier_total": line["line_supplier"],
                "refund_amount": line["line_refund"],
                "acquiring_fee": line["acquiring_fee"],
                "margin": line["margin"],
                "site_income": line["site_income"],
                "organization_income": line["organization_income"],
                "pending_acquiring": line["pending_acquiring"],
            }
        )

    return {
        "order_id": order.id,
        "operation_at": recognition_at.isoformat() if recognition_at else None,
        "rossko_order_id": order.rossko_order_id,
        "buyer_name": order.buyer_name or "",
        "buyer_phone": order.buyer_phone or "",
        "payment_method": method,
        "payment_method_label": PAYMENT_METHOD_LABELS.get(method, method),
        "is_paid": bool(order.is_paid),
        "sale_total": economics["sale_total"],
        "supplier_total": economics["supplier_total"],
        "acquiring_fee": economics["acquiring_fee"],
        "refund_amount": economics["refund_amount"],
        "refund_at": refund_at.isoformat() if refund_at else None,
        "margin": economics["margin"],
        "site_income": economics["site_income"],
        "organization_income": economics["organization_income"],
        "pending_acquiring": economics["pending_acquiring"],
        "items": line_items,
    }


def _fetch_report_orders(db: Session, org_id: str) -> list[GarageNewOrder]:
    return (
        db.query(GarageNewOrder)
        .options(selectinload(GarageNewOrder.items))
        .filter(GarageNewOrder.organization_id == org_id)
        .order_by(GarageNewOrder.created_at.desc())
        .all()
    )


def build_rossko_sales_report(db: Session, org_id: str, filters: RosskoSalesReportFilters) -> dict:
    start, end = _period_bounds(filters.date_from, filters.date_to)
    orders = _fetch_report_orders(db, org_id)
    orders = [order for order in orders if _order_has_supplier_snapshot(order)]
    payment_map = _load_payment_map(db, orders)

    items: list[dict] = []
    for order in orders:
        payment = _resolve_payment(order, payment_map)
        recognition_at = _recognition_datetime(order, payment)
        if recognition_at is None:
            continue
        if recognition_at.tzinfo is None:
            recognition_at = recognition_at.replace(tzinfo=timezone.utc)
        if recognition_at < start or recognition_at > end:
            continue
        if not _matches_search(order, filters.q):
            continue
        items.append(_build_order_row(order, payment))

    summary = {
        "count": len(items),
        "sale_total": Decimal("0.00"),
        "supplier_total": Decimal("0.00"),
        "acquiring_fee": Decimal("0.00"),
        "refund_total": Decimal("0.00"),
        "margin": Decimal("0.00"),
        "site_income": Decimal("0.00"),
        "organization_income": Decimal("0.00"),
        "pending_count": 0,
    }
    for row in items:
        summary["sale_total"] += _money(row["sale_total"])
        summary["supplier_total"] += _money(row["supplier_total"])
        summary["refund_total"] += _money(row["refund_amount"])
        if row["pending_acquiring"]:
            summary["pending_count"] += 1
            continue
        summary["acquiring_fee"] += _money(row["acquiring_fee"])
        summary["margin"] += _money(row["margin"])
        summary["site_income"] += _money(row["site_income"])
        summary["organization_income"] += _money(row["organization_income"])

    return {
        "date_from": filters.date_from,
        "date_to": filters.date_to,
        "summary": summary,
        "items": items,
    }
