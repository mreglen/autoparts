"""Unified PWA push + email notification dispatch."""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.push_notifications import (
    get_sales_order_recipient_user_ids,
    get_sales_returns_recipient_user_ids,
)

logger = logging.getLogger(__name__)

EVENT_NEW_ORDER_SELLER = "new_order_seller"
EVENT_ORDER_STATUS_BUYER = "order_status_buyer"
EVENT_CHAT_MESSAGE = "chat_message"
EVENT_MODERATION_APPROVED = "moderation_approved"
EVENT_MODERATION_REJECTED = "moderation_rejected"
EVENT_STOCK_LOW = "stock_low"
EVENT_RETURN_REQUEST_SELLER = "return_request_seller"
EVENT_RETURN_STATUS_BUYER = "return_status_buyer"
EVENT_SEARCH_SUBSCRIPTION_MATCH = "search_subscription_match"
EVENT_AVITO_MESSENGER = "avito_messenger"

CATEGORY_ORDERS = "orders"
CATEGORY_MESSAGES = "messages"
CATEGORY_SEARCH = "search"
CATEGORY_OTHER = "other"

DEFAULT_NOTIFICATION_PREFS: dict[str, dict[str, bool]] = {
    CATEGORY_ORDERS: {"push": True, "email": True},
    CATEGORY_MESSAGES: {"push": True, "email": True},
    CATEGORY_SEARCH: {"push": True, "email": True},
    CATEGORY_OTHER: {"push": True, "email": True},
}

EVENT_TO_CATEGORY: dict[str, str] = {
    EVENT_NEW_ORDER_SELLER: CATEGORY_ORDERS,
    EVENT_ORDER_STATUS_BUYER: CATEGORY_ORDERS,
    EVENT_RETURN_REQUEST_SELLER: CATEGORY_ORDERS,
    EVENT_RETURN_STATUS_BUYER: CATEGORY_ORDERS,
    EVENT_CHAT_MESSAGE: CATEGORY_MESSAGES,
    EVENT_AVITO_MESSENGER: CATEGORY_MESSAGES,
    EVENT_SEARCH_SUBSCRIPTION_MATCH: CATEGORY_SEARCH,
    EVENT_STOCK_LOW: CATEGORY_OTHER,
    EVENT_MODERATION_APPROVED: CATEGORY_OTHER,
    EVENT_MODERATION_REJECTED: CATEGORY_OTHER,
}

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


def notification_prefs_from_legacy(user: User) -> dict[str, dict[str, bool]]:
    push_enabled = user.notify_push_enabled if user.notify_push_enabled is not None else True
    email_enabled = user.notify_email_enabled if user.notify_email_enabled is not None else True
    channel = {"push": push_enabled, "email": email_enabled}
    return {category: dict(channel) for category in DEFAULT_NOTIFICATION_PREFS}


def normalize_notification_prefs(
    raw: dict[str, Any] | None,
    *,
    user: User | None = None,
) -> dict[str, dict[str, bool]]:
    if not raw and user is not None:
        if user.notification_prefs:
            raw = user.notification_prefs
        else:
            return notification_prefs_from_legacy(user)

    result = {
        category: {
            "push": bool(DEFAULT_NOTIFICATION_PREFS[category]["push"]),
            "email": bool(DEFAULT_NOTIFICATION_PREFS[category]["email"]),
        }
        for category in DEFAULT_NOTIFICATION_PREFS
    }
    if not raw:
        return result

    for category in DEFAULT_NOTIFICATION_PREFS:
        category_raw = raw.get(category)
        if not isinstance(category_raw, dict):
            continue
        if "push" in category_raw:
            result[category]["push"] = bool(category_raw["push"])
        if "email" in category_raw:
            result[category]["email"] = bool(category_raw["email"])
    return result


def get_user_notification_prefs(user: User) -> dict[str, dict[str, bool]]:
    return normalize_notification_prefs(user.notification_prefs, user=user)


def event_category(event_type: str) -> str:
    return EVENT_TO_CATEGORY.get(event_type, CATEGORY_OTHER)


def should_send_push_for_event(user: User, event_type: str) -> bool:
    prefs = get_user_notification_prefs(user)
    category = event_category(event_type)
    return bool(prefs.get(category, {}).get("push", True))


def should_send_email_for_event(user: User, event_type: str) -> bool:
    prefs = get_user_notification_prefs(user)
    category = event_category(event_type)
    return bool(prefs.get(category, {}).get("email", True))


def user_has_any_push_category_enabled(user: User) -> bool:
    prefs = get_user_notification_prefs(user)
    return any(category_prefs.get("push") for category_prefs in prefs.values())


def merge_notification_prefs_patch(
    current: dict[str, dict[str, bool]],
    patch: dict[str, Any] | None,
) -> dict[str, dict[str, bool]]:
    if not patch:
        return current
    merged = normalize_notification_prefs(current)
    for category in DEFAULT_NOTIFICATION_PREFS:
        category_patch = patch.get(category)
        if not isinstance(category_patch, dict):
            continue
        if "push" in category_patch:
            merged[category]["push"] = bool(category_patch["push"])
        if "email" in category_patch:
            merged[category]["email"] = bool(category_patch["email"])
    return merged


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


def dispatch_org_sales_returns_notification(
    db: Session,
    organization_id: str | None,
    *,
    event_type: str,
    push_data: dict[str, Any] | None,
    email_subject: str,
    email_body: str,
) -> None:
    for user_id in get_sales_returns_recipient_user_ids(db, organization_id):
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
    dispatch_org_sales_returns_notification(
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
