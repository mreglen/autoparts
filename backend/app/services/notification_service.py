"""Unified PWA push + email notification dispatch."""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.push_notifications import get_sales_order_recipient_user_ids

logger = logging.getLogger(__name__)

EVENT_NEW_ORDER_SELLER = "new_order_seller"
EVENT_ORDER_STATUS_BUYER = "order_status_buyer"
EVENT_CHAT_MESSAGE = "chat_message"
EVENT_MODERATION_APPROVED = "moderation_approved"
EVENT_MODERATION_REJECTED = "moderation_rejected"
EVENT_STOCK_LOW = "stock_low"
EVENT_RETURN_REQUEST_SELLER = "return_request_seller"
EVENT_RETURN_STATUS_BUYER = "return_status_buyer"

ORDER_STATUS_LABELS: dict[str, str] = {
    "pending": "В ожидании",
    "confirmed": "Подтверждён",
    "rejected": "Не подтверждён",
    "assembled": "Сформирован",
    "shipped": "В доставке",
    "delivered": "Получен",
    "closed": "Закрыт",
    "new_waiting_confirmation": "Ждёт подтверждения",
    "new_assembling": "Комплектуется",
    "new_shipped": "Отгружено",
    "new_awaiting_arrival": "Ожидает поступления",
    "new_received": "Получен",
}

STOCK_LOW_THRESHOLD = 2


def order_status_label(status_code: str | None) -> str:
    if not status_code:
        return "Обновлён"
    return ORDER_STATUS_LABELS.get(status_code, status_code)


def _enqueue_or_send(
    user_id: int,
    *,
    event_type: str,
    push_data: dict[str, Any] | None,
    email_subject: str,
    email_body: str,
) -> None:
    try:
        from app.tasks.notification_tasks import send_user_notification

        send_user_notification.delay(
            user_id,
            event_type,
            push_data,
            email_subject,
            email_body,
        )
    except Exception as exc:
        logger.warning(
            "Celery enqueue failed for %s user %s, sync fallback: %s",
            event_type,
            user_id,
            exc,
        )
        try:
            from app.tasks.notification_tasks import deliver_user_notification

            deliver_user_notification(
                user_id,
                event_type,
                push_data,
                email_subject,
                email_body,
            )
        except Exception as fallback_exc:
            logger.exception(
                "Sync notification fallback failed for %s user %s: %s",
                event_type,
                user_id,
                fallback_exc,
            )


def dispatch_user_notification(
    user_id: int,
    *,
    event_type: str,
    push_data: dict[str, Any] | None,
    email_subject: str,
    email_body: str,
) -> None:
    if not user_id:
        return
    _enqueue_or_send(
        user_id,
        event_type=event_type,
        push_data=push_data,
        email_subject=email_subject,
        email_body=email_body,
    )


def dispatch_org_sales_notification(
    db: Session,
    organization_id: str | None,
    *,
    event_type: str,
    push_data: dict[str, Any] | None,
    email_subject: str,
    email_body: str,
) -> None:
    for user_id in get_sales_order_recipient_user_ids(db, organization_id):
        dispatch_user_notification(
            user_id,
            event_type=event_type,
            push_data=push_data,
            email_subject=email_subject,
            email_body=email_body,
        )


def notify_order_status_buyer(
    *,
    user_id: int | None,
    order_id: int,
    order_kind: str,
    status_code: str,
    previous_status_code: str | None = None,
) -> None:
    if not user_id or status_code == previous_status_code:
        return

    status_label = order_status_label(status_code)
    kind_label = "новых запчастей" if order_kind == "new" else "б/у"
    title = f"Заказ №{order_id}: {status_label}"
    body = f"Статус вашего заказа {kind_label} изменён на «{status_label}»."
    push_data = {
        "type": "order_status",
        "orderId": order_id,
        "orderKind": order_kind,
        "statusCode": status_code,
        "title": title,
        "body": body,
        "url": "/purchases/orders",
    }
    email_body = (
        f"{body}\n\n"
        f"Откройте раздел «Мои заказы»: https://svoygarage.ru/purchases/orders\n\n"
        f"С уважением,\nСвой Гараж"
    )
    dispatch_user_notification(
        user_id,
        event_type=EVENT_ORDER_STATUS_BUYER,
        push_data=push_data,
        email_subject=title,
        email_body=email_body,
    )


def _stock_recipient_ids(db: Session, product) -> list[int]:
    if getattr(product, "created_by", None):
        return [int(product.created_by)]
    return get_sales_order_recipient_user_ids(db, getattr(product, "organization_id", None))


def maybe_notify_stock_level(db: Session, product, previous_quantity: int | None) -> None:
    if product is None:
        return

    prev = int(previous_quantity or 0)
    new_qty = int(getattr(product, "quantity", 0) or 0)

    if prev > 0 and new_qty == 0:
        event_label = "нет в наличии"
        title = f"Товар закончился: {product.name}"
        body = f"«{product.name}» — остаток 0 шт."
    elif prev > STOCK_LOW_THRESHOLD and 0 < new_qty <= STOCK_LOW_THRESHOLD:
        event_label = "низкий остаток"
        title = f"Низкий остаток: {product.name}"
        body = f"«{product.name}» — осталось {new_qty} шт."
    else:
        return

    push_data = {
        "type": "stock",
        "productId": product.id,
        "title": title,
        "body": body,
        "url": "/my-parts",
    }
    email_body = (
        f"{body}\n\n"
        f"Проверьте склад: https://svoygarage.ru/my-parts\n\n"
        f"С уважением,\nСвой Гараж"
    )

    for user_id in _stock_recipient_ids(db, product):
        dispatch_user_notification(
            user_id,
            event_type=EVENT_STOCK_LOW,
            push_data=push_data,
            email_subject=f"Склад: {event_label} — {product.name}",
            email_body=email_body,
        )


def notify_return_request_seller(
    db: Session,
    *,
    organization_id: str | None,
    return_id: int,
    order_id: int,
    reason_label: str,
) -> None:
    title = f"Новая заявка на возврат №{return_id}"
    body = f"По заказу №{order_id}: {reason_label}."
    push_data = {
        "type": "return_request",
        "returnId": return_id,
        "orderId": order_id,
        "title": title,
        "body": body,
        "url": "/sales/returns",
    }
    email_body = (
        f"{body}\n\n"
        f"Откройте раздел возвратов: https://svoygarage.ru/sales/returns\n\n"
        f"С уважением,\nСвой Гараж"
    )
    dispatch_org_sales_notification(
        db,
        organization_id,
        event_type=EVENT_RETURN_REQUEST_SELLER,
        push_data=push_data,
        email_subject=title,
        email_body=email_body,
    )


def notify_return_status_buyer(
    *,
    user_id: int | None,
    return_id: int,
    order_id: int,
    status_code: str,
    previous_status_code: str | None = None,
) -> None:
    if not user_id or status_code == previous_status_code:
        return

    from app.services.order_return_service import return_status_label

    status_label = return_status_label(status_code)
    title = f"Возврат №{return_id}: {status_label}"
    body = f"Статус заявки на возврат по заказу №{order_id} изменён на «{status_label}»."
    push_data = {
        "type": "return_status",
        "returnId": return_id,
        "orderId": order_id,
        "statusCode": status_code,
        "title": title,
        "body": body,
        "url": "/purchases/returns",
    }
    email_body = (
        f"{body}\n\n"
        f"Подробности: https://svoygarage.ru/purchases/returns\n\n"
        f"С уважением,\nСвой Гараж"
    )
    dispatch_user_notification(
        user_id,
        event_type=EVENT_RETURN_STATUS_BUYER,
        push_data=push_data,
        email_subject=title,
        email_body=email_body,
    )
