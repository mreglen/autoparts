from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.repair_order import RepairOrder
from app.services.autoservice_payroll import clear_order_accruals
from app.services.repair_order_stock_reserve import release_order_reservations


def _restore_completed_order_stock(
    db: Session,
    *,
    org_id: str,
    order: RepairOrder,
) -> None:
    """Return autoservice-stock consumed on order completion back to warehouse."""
    from app.services.autoservice_warehouse_service import (
        revert_autoservice_stock_for_order,
    )

    revert_autoservice_stock_for_order(db, org_id=org_id, order=order)


def delete_repair_order(
    db: Session,
    *,
    org_id: str,
    order_id: int,
) -> None:
    order = (
        db.query(RepairOrder)
        .filter(
            RepairOrder.id == order_id,
            RepairOrder.organization_id == org_id,
        )
        .first()
    )
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запись не найдена",
        )

    if order.status == "completed":
        _restore_completed_order_stock(db, org_id=org_id, order=order)
    elif order.status != "cancelled":
        release_order_reservations(db, order)

    clear_order_accruals(db, order.id)
    db.delete(order)
    db.flush()
