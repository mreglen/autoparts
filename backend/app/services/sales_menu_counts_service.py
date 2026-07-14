"""Счётчики для бейджей меню «Продажи» в сайдбаре."""
from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.garage_new_orders import GarageNewOrder
from app.models.garage_used_orders import GarageUsedOrder
from app.models.order_return import OrderReturnRequest
from app.models.user import User
from app.services.push_notifications import (
    user_has_sales_orders_access,
    user_has_sales_returns_access,
)


def _count_pending_orders(db: Session, organization_id: str) -> int:
    used_pending = (
        db.query(func.count(GarageUsedOrder.id))
        .filter(
            GarageUsedOrder.organization_id == organization_id,
            GarageUsedOrder.status_code == "pending",
        )
        .scalar()
        or 0
    )
    new_pending = (
        db.query(func.count(GarageNewOrder.id))
        .filter(
            GarageNewOrder.organization_id == organization_id,
            GarageNewOrder.status_code == "new_waiting_confirmation",
        )
        .scalar()
        or 0
    )
    return int(used_pending) + int(new_pending)


def _count_requested_returns(db: Session, organization_id: str) -> int:
    return int(
        db.query(func.count(OrderReturnRequest.id))
        .filter(
            OrderReturnRequest.organization_id == organization_id,
            OrderReturnRequest.status_code == "requested",
        )
        .scalar()
        or 0
    )


def user_has_sales_menu_access(db: Session, user: User) -> bool:
    return user_has_sales_orders_access(db, user) or user_has_sales_returns_access(db, user)


def get_sales_menu_badge_counts(db: Session, user: User) -> dict[str, int]:
    org_id = user.organization_id
    orders = 0
    returns = 0

    if org_id:
        if user_has_sales_orders_access(db, user):
            orders = _count_pending_orders(db, org_id)
        if user_has_sales_returns_access(db, user):
            returns = _count_requested_returns(db, org_id)

    return {
        "orders": orders,
        "returns": returns,
        "sales": orders + returns,
    }
