from __future__ import annotations

import logging
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.models.autoservice_contractor_payout import AutoserviceContractorPayout
from app.models.repair_order import RepairOrder
from app.services.autoservice_payroll import _period_bounds

logger = logging.getLogger(__name__)

ACCRUAL_TYPE = "contractor_fixed"


def _money(value: Decimal | float | int) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def clear_order_contractor_payouts(db: Session, order_id: int) -> None:
    db.query(AutoserviceContractorPayout).filter(
        AutoserviceContractorPayout.order_id == order_id,
    ).delete(synchronize_session=False)


def accrue_order_contractor_payouts(
    db: Session,
    order: RepairOrder,
    *,
    accrued_at: datetime | None = None,
) -> None:
    clear_order_contractor_payouts(db, order.id)
    for work in sorted(order.works or [], key=lambda w: (w.position, w.id or 0)):
        for row in work.contractors or []:
            amount = _money(row.amount)
            if amount <= 0:
                continue
            db.add(
                AutoserviceContractorPayout(
                    organization_id=order.organization_id,
                    contractor_id=row.contractor_id,
                    order_id=order.id,
                    work_id=work.id,
                    work_title=work.title,
                    accrual_type=ACCRUAL_TYPE,
                    amount=amount,
                    accrued_at=accrued_at,
                )
            )


def order_contractor_cost(db: Session, order: RepairOrder) -> Decimal:
    total = Decimal("0")
    for work in order.works or []:
        for row in work.contractors or []:
            total += _money(row.amount)
    return _money(total)


def compute_contractor_stats(
    db: Session,
    org_id: str,
    contractor_id: int,
    period: str,
    *,
    year: int | None = None,
    month: int | None = None,
) -> dict:
    if year is not None and month is not None:
        from app.services.autoservice_payroll import month_bounds

        start, end = month_bounds(year, month)
    else:
        start, end = _period_bounds(period)

    rows = (
        db.query(AutoserviceContractorPayout)
        .filter(
            AutoserviceContractorPayout.organization_id == org_id,
            AutoserviceContractorPayout.contractor_id == contractor_id,
            AutoserviceContractorPayout.accrued_at >= start,
            AutoserviceContractorPayout.accrued_at < end,
        )
        .all()
    )
    total = sum(_money(row.amount) for row in rows)
    return {
        "period": period,
        "total": _money(total),
        "orders_count": len({row.order_id for row in rows}),
        "works_count": len({row.work_id for row in rows if row.work_id}),
    }
