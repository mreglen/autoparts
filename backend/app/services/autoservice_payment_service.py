from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.autoservice_payment import AutoservicePayment
from app.models.repair_order import RepairOrder
from app.schemas.autoservice_finance import (
    AutoserviceFinanceReceiptRow,
    AutoserviceFinanceReceiptsResponse,
    AutoservicePaymentMethodTotals,
)

_TWOPLACES = Decimal("0.01")
_VALID_METHODS = {"card", "cash", "bank"}


def _money(value: Decimal | int | float | str) -> Decimal:
    return Decimal(str(value)).quantize(_TWOPLACES, rounding=ROUND_HALF_UP)


def allocate_autoservice_payment_number(db: Session, organization_id: str) -> int:
    current = (
        db.query(func.max(AutoservicePayment.sequential_number))
        .filter(AutoservicePayment.organization_id == organization_id)
        .scalar()
    )
    return int(current or 0) + 1


def sum_order_payments(db: Session, order_id: int) -> Decimal:
    total = (
        db.query(func.coalesce(func.sum(AutoservicePayment.amount), 0))
        .filter(AutoservicePayment.repair_order_id == order_id)
        .scalar()
    )
    return _money(total or 0)


def batch_paid_amounts(db: Session, order_ids: list[int]) -> dict[int, Decimal]:
    if not order_ids:
        return {}
    rows = (
        db.query(
            AutoservicePayment.repair_order_id,
            func.coalesce(func.sum(AutoservicePayment.amount), 0),
        )
        .filter(AutoservicePayment.repair_order_id.in_(order_ids))
        .group_by(AutoservicePayment.repair_order_id)
        .all()
    )
    return {order_id: _money(amount) for order_id, amount in rows}


def order_payment_summary(db: Session, order: RepairOrder, grand_total: Decimal) -> tuple[Decimal, Decimal, bool]:
    paid = sum_order_payments(db, order.id)
    total = _money(grand_total)
    remaining = _money(max(Decimal("0.00"), total - paid))
    is_paid = remaining <= Decimal("0.00")
    return paid, remaining, is_paid


def ensure_order_fully_paid(db: Session, order: RepairOrder, grand_total: Decimal) -> None:
    _, remaining, _ = order_payment_summary(db, order, grand_total)
    if remaining > Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Заказ-наряд можно завершить только после полной оплаты",
        )


def create_repair_order_payment(
    db: Session,
    *,
    order: RepairOrder,
    org_id: str,
    user_id: int,
    method: str,
    amount: Decimal,
    grand_total: Decimal,
    paid_at: date | None = None,
) -> AutoservicePayment:
    if method not in _VALID_METHODS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недопустимый способ оплаты",
        )
    pay_amount = _money(amount)
    if pay_amount <= Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сумма оплаты должна быть больше нуля",
        )
    _, remaining, _ = order_payment_summary(db, order, grand_total)
    if pay_amount > remaining:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сумма оплаты превышает остаток к оплате",
        )
    effective_date = paid_at or date.today()
    if effective_date == date.today():
        created_at = datetime.now()
    else:
        created_at = datetime.combine(effective_date, time(12, 0))
    payment = AutoservicePayment(
        organization_id=org_id,
        repair_order_id=order.id,
        sequential_number=allocate_autoservice_payment_number(db, org_id),
        method=method,
        amount=pay_amount,
        created_by_user_id=user_id,
        created_at=created_at,
    )
    db.add(payment)
    db.flush()
    return payment


def _period_bounds(date_from: date, date_to: date) -> tuple[datetime, datetime]:
    start = datetime.combine(date_from, time.min)
    end = datetime.combine(date_to, time.max)
    if end < start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректный период",
        )
    return start, end


def list_finance_receipts(
    db: Session,
    *,
    org_id: str,
    date_from: date,
    date_to: date,
) -> AutoserviceFinanceReceiptsResponse:
    start, end = _period_bounds(date_from, date_to)
    rows = (
        db.query(AutoservicePayment)
        .options(
            joinedload(AutoservicePayment.order).joinedload(RepairOrder.client),
        )
        .join(RepairOrder, AutoservicePayment.repair_order_id == RepairOrder.id)
        .filter(
            AutoservicePayment.organization_id == org_id,
            AutoservicePayment.created_at >= start,
            AutoservicePayment.created_at <= end,
        )
        .order_by(AutoservicePayment.created_at.desc(), AutoservicePayment.id.desc())
        .all()
    )
    totals = AutoservicePaymentMethodTotals()
    items: list[AutoserviceFinanceReceiptRow] = []
    for row in rows:
        method = row.method if row.method in _VALID_METHODS else "cash"
        amount = _money(row.amount)
        setattr(totals, method, _money(getattr(totals, method) + amount))
        order = row.order
        client_name = order.client.name if order and order.client else "—"
        items.append(
            AutoserviceFinanceReceiptRow(
                sequential_number=row.sequential_number,
                repair_order_id=row.repair_order_id,
                repair_order_number=order.order_number if order else str(row.repair_order_id),
                client_name=client_name,
                amount=amount,
                method=method,
                created_at=row.created_at,
            )
        )
    total_amount = _money(totals.card + totals.cash + totals.bank)
    return AutoserviceFinanceReceiptsResponse(
        totals=totals,
        total_amount=total_amount,
        count=len(items),
        items=items,
    )
