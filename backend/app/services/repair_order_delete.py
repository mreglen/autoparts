from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.autoservice_warehouse import AutoserviceWarehouseExpense, AutoserviceWarehouseItem
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
    order_label = f"Заказ-наряд №{order.order_number}"
    expenses = (
        db.query(AutoserviceWarehouseExpense)
        .options(joinedload(AutoserviceWarehouseExpense.item))
        .filter(
            AutoserviceWarehouseExpense.organization_id == org_id,
            AutoserviceWarehouseExpense.reason == order_label,
        )
        .all()
    )
    item_ids = {expense.item_id for expense in expenses if expense.item_id}
    locked_items = {
        row.id: row
        for row in (
            db.query(AutoserviceWarehouseItem)
            .filter(
                AutoserviceWarehouseItem.id.in_(item_ids),
                AutoserviceWarehouseItem.organization_id == org_id,
            )
            .with_for_update()
            .all()
        )
    } if item_ids else {}

    for expense in expenses:
        item = locked_items.get(expense.item_id) or expense.item
        if item:
            item.quantity = int(item.quantity or 0) + int(expense.quantity or 0)
        db.delete(expense)


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
