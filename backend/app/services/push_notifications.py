"""Web Push для продавцов (новые заказы) и прочих событий."""
from __future__ import annotations

from typing import Iterable

from sqlalchemy.orm import Session

from app.models.permission import Permission
from app.models.user import User
from app.models.user_permission import UserPermission


def user_has_sales_orders_access(db: Session, user: User) -> bool:
    if user.is_admin or user.is_seller:
        return True
    if not user.is_employee:
        return False
    q = (
        db.query(Permission.code)
        .join(UserPermission, UserPermission.permission_id == Permission.id)
        .filter(UserPermission.user_id == user.id, Permission.code == "sales.orders")
    )
    return db.query(q.exists()).scalar() is True


def get_sales_order_recipient_user_ids(db: Session, organization_id: str | None) -> list[int]:
    if not organization_id:
        return []
    users = db.query(User).filter(User.organization_id == organization_id).all()
    return [u.id for u in users if user_has_sales_orders_access(db, u)]


def _format_amount(total_amount: float | None) -> str:
    if total_amount is None:
        return ""
    try:
        value = float(total_amount)
    except (TypeError, ValueError):
        return ""
    if value <= 0:
        return ""
    formatted = f"{value:,.0f}".replace(",", " ")
    return f" · {formatted} ₽"


def notify_sellers_new_order(
    db: Session,
    *,
    organization_id: str | None,
    order_id: int,
    order_kind: str,
    buyer_name: str | None = None,
    total_amount: float | None = None,
) -> None:
    """Push-уведомление продавцам организации о новом заказе."""
    from app.core.config import settings
    from app.routers.notifications import send_push_notification

    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        return

    recipient_ids = get_sales_order_recipient_user_ids(db, organization_id)
    if not recipient_ids:
        return

    buyer = (buyer_name or "Покупатель").strip() or "Покупатель"
    title = f"Новый заказ №{order_id}"
    body = f"{buyer}{_format_amount(total_amount)}"

    push_data = {
        "type": "order",
        "orderId": order_id,
        "orderKind": order_kind,
        "title": title,
        "body": body,
        "url": "/sales/orders",
    }

    for user_id in recipient_ids:
        send_push_notification(user_id, push_data, db)


def notify_sellers_new_orders_batch(
    db: Session,
    orders: Iterable[dict],
) -> None:
    for item in orders:
        notify_sellers_new_order(
            db,
            organization_id=item.get("organization_id"),
            order_id=int(item["order_id"]),
            order_kind=str(item.get("order_kind") or "used"),
            buyer_name=item.get("buyer_name"),
            total_amount=item.get("total_amount"),
        )
