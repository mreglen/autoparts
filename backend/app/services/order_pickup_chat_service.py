"""Автосообщение покупателю в чат «Гараж», когда заказ готов к выдаче."""
from __future__ import annotations

import logging

import anyio
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session

from app.models.chat import Chat, Message
from app.services.organization_chat_service import CHAT_TYPE_DIRECT
from app.services.pickup_verification_service import NEW_PICKUP_READY_STATUS, PICKUP_READY_STATUS

logger = logging.getLogger(__name__)

PICKUP_READY_STATUSES = {PICKUP_READY_STATUS, NEW_PICKUP_READY_STATUS}


def build_order_ready_pickup_chat_message(
    *,
    order_id: int,
    order_kind: str,
    pickup_code: str | None,
) -> str:
    kind_label = "новых запчастей" if order_kind == "new" else "б/у"
    text = f"Здравствуйте! Ваш заказ {kind_label} №{order_id} готов к выдаче."
    if pickup_code:
        text += f" Код для получения: {pickup_code}."
    return text


def get_or_create_direct_garage_chat(db: Session, *, buyer_id: int, seller_id: int) -> Chat:
    existing = (
        db.query(Chat)
        .filter(
            Chat.buyer_id == buyer_id,
            Chat.seller_id == seller_id,
            Chat.is_active.is_(True),
            or_(Chat.chat_type == CHAT_TYPE_DIRECT, Chat.chat_type.is_(None)),
        )
        .order_by(desc(Chat.updated_at))
        .first()
    )
    if existing:
        return existing

    chat = Chat(
        chat_type=CHAT_TYPE_DIRECT,
        buyer_id=buyer_id,
        seller_id=seller_id,
        product_id=None,
    )
    db.add(chat)
    db.flush()
    return chat


def _broadcast_chat_message(db: Session, message: Message, *, exclude_user_id: int) -> None:
    from app.routers.websocket import manager as websocket_manager

    ws_payload = {
        "type": "message",
        "id": message.id,
        "chat_id": message.chat_id,
        "sender_id": message.sender_id,
        "message": message.message,
        "is_read": message.is_read,
        "reply_to_id": message.reply_to_id,
        "reply_to": None,
        "created_at": message.created_at.isoformat(),
        "media": [],
    }
    try:
        anyio.from_thread.run(
            websocket_manager.broadcast_to_chat,
            ws_payload,
            message.chat_id,
            db,
            exclude_user_id,
        )
    except Exception:
        logger.exception("Failed to broadcast order-ready chat message for chat_id=%s", message.chat_id)


def send_chat_message_as_seller(
    db: Session,
    *,
    chat_id: int,
    seller_user_id: int,
    text: str,
) -> Message:
    message = Message(
        chat_id=chat_id,
        sender_id=seller_user_id,
        message=text.strip(),
    )
    db.add(message)
    db.query(Chat).filter(Chat.id == chat_id).update({"updated_at": func.now()})
    db.commit()
    db.refresh(message)
    _broadcast_chat_message(db, message, exclude_user_id=seller_user_id)
    return message


def maybe_send_order_ready_pickup_chat_message(
    db: Session,
    *,
    buyer_user_id: int | None,
    seller_user_id: int,
    order_id: int,
    order_kind: str,
    pickup_code: str | None,
    previous_status_code: str | None,
    new_status_code: str,
) -> None:
    if new_status_code not in PICKUP_READY_STATUSES:
        return
    if new_status_code == previous_status_code:
        return
    if not buyer_user_id or buyer_user_id == seller_user_id:
        return

    try:
        chat = get_or_create_direct_garage_chat(
            db,
            buyer_id=buyer_user_id,
            seller_id=seller_user_id,
        )
        text = build_order_ready_pickup_chat_message(
            order_id=order_id,
            order_kind=order_kind,
            pickup_code=pickup_code,
        )
        send_chat_message_as_seller(
            db,
            chat_id=chat.id,
            seller_user_id=seller_user_id,
            text=text,
        )
    except Exception:
        logger.exception(
            "Failed to send order-ready chat message: order_id=%s kind=%s buyer=%s seller=%s",
            order_id,
            order_kind,
            buyer_user_id,
            seller_user_id,
        )
        db.rollback()
