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


def user_has_sales_returns_access(db: Session, user: User) -> bool:
    if user.is_admin or user.is_seller:
        return True
    if not user.is_employee:
        return False
    q = (
        db.query(Permission.code)
        .join(UserPermission, UserPermission.permission_id == Permission.id)
        .filter(UserPermission.user_id == user.id, Permission.code == "sales.returns")
    )
    return db.query(q.exists()).scalar() is True


def get_sales_order_recipient_user_ids(db: Session, organization_id: str | None) -> list[int]:
    if not organization_id:
        return []
    users = db.query(User).filter(User.organization_id == organization_id).all()
    return [u.id for u in users if user_has_sales_orders_access(db, u)]


def get_sales_returns_recipient_user_ids(db: Session, organization_id: str | None) -> list[int]:
    if not organization_id:
        return []
    users = db.query(User).filter(User.organization_id == organization_id).all()
    return [u.id for u in users if user_has_sales_returns_access(db, u)]


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
    """Push + email продавцам организации о новом заказе."""
    from app.services.notification_service import EVENT_NEW_ORDER_SELLER, dispatch_org_sales_notification

    recipient_ids = get_sales_order_recipient_user_ids(db, organization_id)
    if not recipient_ids:
        return

    buyer = (buyer_name or "Покупатель").strip() or "Покупатель"
    title = f"Новый заказ №{order_id}"
    body = f"{buyer}{_format_amount(total_amount)}"
    kind_label = "новых запчастей" if order_kind == "new" else "б/у"

    push_data = {
        "type": "order",
        "orderId": order_id,
        "orderKind": order_kind,
        "title": title,
        "body": body,
        "url": "/sales/orders",
    }
    email_body = (
        f"Поступил новый заказ {kind_label} №{order_id}.\n"
        f"Покупатель: {buyer}{_format_amount(total_amount)}\n\n"
        f"Откройте раздел заказов: https://svoygarage.ru/sales/orders\n\n"
        f"С уважением,\nСвой Гараж"
    )

    dispatch_org_sales_notification(
        db,
        organization_id,
        event_type=EVENT_NEW_ORDER_SELLER,
        push_data=push_data,
        email_subject=title,
        email_body=email_body,
    )


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
