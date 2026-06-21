"""Сессии оплаты новых запчастей через ЮKassa."""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.carts.new_parts_cart import NewPartsCart
from app.models.new_parts_checkout_session import NewPartsCheckoutSession
from app.models.user import User as UserModel
from app.models.yookassa_payment import YookassaPayment
from app.schemas.rossko_settings import NewPartsOrderCreateIn
from app.services.audit_service import log_audit
from app.services.new_parts_order_fulfillment import (
    fulfill_new_parts_order,
    parse_cart_snapshot,
)
from app.services.yookassa_client import get_yookassa_client
from app.services.yookassa_receipt_builder import build_receipt
from app.utils.guest_cart import get_or_create_user_cart

logger = logging.getLogger(__name__)

# Назначение платежа в банке / ЮKassa (поле description).
YOOKASSA_PAYMENT_DESCRIPTION = "Оплата svoygarage.ru"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _format_amount(value: float) -> str:
    return f"{value:.2f}"


def _serialize_cart_item(item: NewPartsCart) -> dict[str, Any]:
    return {
        "id": item.id,
        "brand": item.brand,
        "partnumber": item.partnumber,
        "name": item.name,
        "quantity": int(item.quantity),
        "price": float(item.price),
        "stock_id": str(item.stock_id),
    }


def _load_user_cart_items(db: Session, user_id: int) -> list[NewPartsCart]:
    cart = get_or_create_user_cart(db, user_id)
    items = (
        db.query(NewPartsCart)
        .filter(NewPartsCart.cart_id == cart.id, NewPartsCart.user_id == user_id)
        .all()
    )
    return items


def _session_or_404(db: Session, session_id: str, user_id: int) -> NewPartsCheckoutSession:
    session = (
        db.query(NewPartsCheckoutSession)
        .filter(NewPartsCheckoutSession.id == session_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сессия оплаты не найдена")
    if session.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к сессии")
    return session


def _expire_if_needed(session: NewPartsCheckoutSession) -> None:
    if session.status != "awaiting_payment":
        return
    expires = session.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if _utcnow() > expires:
        session.status = "expired"


def _extract_qr_payload(confirmation: dict[str, Any] | None) -> str | None:
    if not confirmation:
        return None
    data = confirmation.get("confirmation_data")
    if isinstance(data, str) and data.strip():
        return data.strip()
    return None


def _apply_yookassa_payment_row(
    row: YookassaPayment,
    api_payment: dict[str, Any],
    *,
    webhook_payload: dict[str, Any] | None = None,
) -> None:
    row.yookassa_payment_id = api_payment.get("id") or row.yookassa_payment_id
    row.status = str(api_payment.get("status") or row.status)
    amount = api_payment.get("amount") or {}
    if isinstance(amount, dict):
        try:
            row.amount_value = float(amount.get("value") or row.amount_value)
        except (TypeError, ValueError):
            pass
        row.amount_currency = str(amount.get("currency") or row.amount_currency)

    paid_at = api_payment.get("captured_at") or api_payment.get("paid")
    if paid_at and row.status == "succeeded":
        try:
            row.paid_at = datetime.fromisoformat(str(paid_at).replace("Z", "+00:00"))
        except ValueError:
            row.paid_at = _utcnow()

    row.captured = api_payment.get("paid") if "paid" in api_payment else row.captured
    row.refundable = api_payment.get("refundable")
    confirmation = api_payment.get("confirmation")
    if isinstance(confirmation, dict):
        row.confirmation_type = confirmation.get("type")
        row.confirmation_url = confirmation.get("confirmation_url")
        qr = _extract_qr_payload(confirmation)
        if qr:
            row.qr_payload = qr
    if webhook_payload is not None:
        row.raw_webhook_payload = json.dumps(webhook_payload, ensure_ascii=False)


async def create_checkout_session(
    db: Session,
    user: UserModel,
    payload: NewPartsOrderCreateIn,
) -> dict[str, Any]:
    if not settings.yookassa_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Онлайн-оплата временно недоступна",
        )

    cart_items = _load_user_cart_items(db, user.id)
    if not cart_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="В корзине нет новых запчастей",
        )

    total = sum(float(i.price) * int(i.quantity) for i in cart_items)
    if total <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сумма заказа должна быть больше нуля",
        )

    snapshot = [_serialize_cart_item(i) for i in cart_items]
    session_id = str(uuid.uuid4())
    expires_at = _utcnow() + timedelta(minutes=settings.YOOKASSA_PAYMENT_TTL_MINUTES)

    session = NewPartsCheckoutSession(
        id=session_id,
        user_id=user.id,
        status="awaiting_payment",
        amount=total,
        currency="RUB",
        order_payload=payload.model_dump_json(),
        cart_snapshot=json.dumps(snapshot, ensure_ascii=False),
        expires_at=expires_at,
    )
    db.add(session)
    db.flush()

    receipt = build_receipt(
        customer_email=payload.recipient_email or user.email,
        customer_phone=payload.recipient_phone,
        cart_items=snapshot,
    )

    idempotence_key = str(uuid.uuid4())
    payment_body: dict[str, Any] = {
        "amount": {"value": _format_amount(total), "currency": "RUB"},
        "capture": True,
        "description": YOOKASSA_PAYMENT_DESCRIPTION,
        "metadata": {
            "checkout_session_id": session_id,
            "user_id": str(user.id),
        },
        "payment_method_data": {"type": "sbp"},
        "confirmation": {"type": "qr"},
        "receipt": receipt,
    }

    client = get_yookassa_client()
    api_payment = await client.create_payment(payment_body, idempotence_key)

    payment_row = YookassaPayment(
        id=str(uuid.uuid4()),
        idempotence_key=idempotence_key,
        session_id=session_id,
        user_id=user.id,
        yookassa_payment_id=api_payment.get("id"),
        payment_method_type="sbp",
        status=str(api_payment.get("status") or "pending"),
        amount_value=total,
        amount_currency="RUB",
        description=payment_body["description"],
        confirmation_type="qr",
        receipt_snapshot=json.dumps(receipt, ensure_ascii=False),
        payment_metadata=json.dumps(payment_body["metadata"], ensure_ascii=False),
        raw_create_response=json.dumps(api_payment, ensure_ascii=False),
    )
    confirmation = api_payment.get("confirmation")
    if isinstance(confirmation, dict):
        payment_row.confirmation_url = confirmation.get("confirmation_url")
        payment_row.qr_payload = _extract_qr_payload(confirmation)

    db.add(payment_row)
    db.commit()
    db.refresh(session)

    return build_session_view(db, session, user)


async def create_card_payment(
    db: Session,
    user: UserModel,
    session_id: str,
) -> dict[str, Any]:
    session = _session_or_404(db, session_id, user.id)
    _expire_if_needed(session)
    if session.status == "expired":
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Время оплаты истекло")
    if session.status in ("fulfilled", "fulfillment_failed"):
        return build_session_view(db, session, user)

    return_url = (
        f"{settings.PUBLIC_BASE_URL.rstrip('/')}/cart/new/pay/{session_id}?card=1"
    )

    order_data = json.loads(session.order_payload or "{}")
    snapshot_raw = json.loads(session.cart_snapshot or "[]")
    receipt = build_receipt(
        customer_email=order_data.get("recipient_email") or user.email,
        customer_phone=order_data.get("recipient_phone"),
        cart_items=snapshot_raw if isinstance(snapshot_raw, list) else [],
    )

    idempotence_key = str(uuid.uuid4())
    payment_body: dict[str, Any] = {
        "amount": {"value": _format_amount(session.amount), "currency": "RUB"},
        "capture": True,
        "description": YOOKASSA_PAYMENT_DESCRIPTION,
        "metadata": {
            "checkout_session_id": session_id,
            "user_id": str(user.id),
        },
        "payment_method_data": {"type": "bank_card"},
        "confirmation": {"type": "redirect", "return_url": return_url},
        "receipt": receipt,
    }

    client = get_yookassa_client()
    api_payment = await client.create_payment(payment_body, idempotence_key)

    payment_row = YookassaPayment(
        id=str(uuid.uuid4()),
        idempotence_key=idempotence_key,
        session_id=session_id,
        user_id=user.id,
        yookassa_payment_id=api_payment.get("id"),
        payment_method_type="bank_card",
        status=str(api_payment.get("status") or "pending"),
        amount_value=session.amount,
        amount_currency="RUB",
        description=payment_body["description"],
        confirmation_type="redirect",
        receipt_snapshot=json.dumps(receipt, ensure_ascii=False),
        payment_metadata=json.dumps(payment_body["metadata"], ensure_ascii=False),
        raw_create_response=json.dumps(api_payment, ensure_ascii=False),
    )
    confirmation = api_payment.get("confirmation")
    if isinstance(confirmation, dict):
        payment_row.confirmation_url = confirmation.get("confirmation_url")

    db.add(payment_row)
    db.commit()

    return {
        "confirmation_url": payment_row.confirmation_url,
        "payment_id": payment_row.yookassa_payment_id,
    }


def build_session_view(
    db: Session,
    session: NewPartsCheckoutSession,
    user: UserModel,
) -> dict[str, Any]:
    _expire_if_needed(session)
    sbp_payment = (
        db.query(YookassaPayment)
        .filter(
            YookassaPayment.session_id == session.id,
            YookassaPayment.payment_method_type == "sbp",
        )
        .order_by(YookassaPayment.created_at.desc())
        .first()
    )
    card_payment = (
        db.query(YookassaPayment)
        .filter(
            YookassaPayment.session_id == session.id,
            YookassaPayment.payment_method_type == "bank_card",
        )
        .order_by(YookassaPayment.created_at.desc())
        .first()
    )

    paid_payment = (
        db.query(YookassaPayment)
        .filter(
            YookassaPayment.session_id == session.id,
            YookassaPayment.status == "succeeded",
        )
        .order_by(YookassaPayment.created_at.desc())
        .first()
    )

    return {
        "session_id": session.id,
        "status": session.status,
        "amount": session.amount,
        "currency": session.currency,
        "expires_at": session.expires_at.isoformat() if session.expires_at else None,
        "garage_order_id": session.garage_order_id,
        "qr_payload": sbp_payment.qr_payload if sbp_payment else None,
        "card_confirmation_url": card_payment.confirmation_url if card_payment else None,
        "sbp_payment_status": sbp_payment.status if sbp_payment else None,
        "card_payment_status": card_payment.status if card_payment else None,
        "refund_status": paid_payment.refund_status if paid_payment else None,
    }


async def get_session_for_user(
    db: Session,
    user: UserModel,
    session_id: str,
) -> dict[str, Any]:
    session = _session_or_404(db, session_id, user.id)
    if session.status in ("awaiting_payment", "refund_pending"):
        await try_sync_session_payments(db, session)
    return build_session_view(db, session, user)


async def _sync_pending_refund(db: Session, session: NewPartsCheckoutSession) -> None:
    if session.status != "refund_pending":
        return
    paid = (
        db.query(YookassaPayment)
        .filter(
            YookassaPayment.session_id == session.id,
            YookassaPayment.status == "succeeded",
            YookassaPayment.refund_id.isnot(None),
        )
        .order_by(YookassaPayment.created_at.desc())
        .first()
    )
    if not paid or not paid.refund_id:
        return
    client = get_yookassa_client()
    refund = await client.get_refund(paid.refund_id)
    paid.refund_status = str(refund.get("status") or paid.refund_status)
    if paid.refund_status == "succeeded":
        session.status = "refunded"
        session.garage_order_id = None
    elif paid.refund_status == "canceled":
        session.status = "fulfillment_failed"
        paid.refund_status = "failed"


async def try_sync_session_payments(db: Session, session: NewPartsCheckoutSession) -> None:
    """Подтянуть статус из API (polling с фронта)."""
    if session.status == "refund_pending":
        await _sync_pending_refund(db, session)
        db.commit()
        return

    pending = (
        db.query(YookassaPayment)
        .filter(
            YookassaPayment.session_id == session.id,
            YookassaPayment.status.in_(("pending", "waiting_for_capture")),
        )
        .all()
    )
    if not pending:
        return
    client = get_yookassa_client()
    for row in pending:
        if not row.yookassa_payment_id:
            continue
        api_payment = await client.get_payment(row.yookassa_payment_id)
        _apply_yookassa_payment_row(row, api_payment)
        if api_payment.get("status") == "succeeded":
            await _on_payment_succeeded(db, session, row, api_payment)
    db.commit()


async def handle_yookassa_webhook(db: Session, event: dict[str, Any]) -> None:
    obj = event.get("object")
    if not isinstance(obj, dict):
        return
    payment_id = obj.get("id")
    if not payment_id:
        return

    row = (
        db.query(YookassaPayment)
        .filter(YookassaPayment.yookassa_payment_id == payment_id)
        .first()
    )
    if not row:
        logger.warning("YooKassa webhook: unknown payment %s", payment_id)
        return

    client = get_yookassa_client()
    api_payment = await client.get_payment(payment_id)
    _apply_yookassa_payment_row(row, api_payment, webhook_payload=event)

    session = (
        db.query(NewPartsCheckoutSession)
        .filter(NewPartsCheckoutSession.id == row.session_id)
        .first()
    )
    if not session:
        db.commit()
        return

    event_type = event.get("event")
    if event_type == "payment.succeeded" or api_payment.get("status") == "succeeded":
        await _on_payment_succeeded(db, session, row, api_payment)
    elif event_type == "payment.canceled" or api_payment.get("status") == "canceled":
        if session.status == "awaiting_payment":
            session.status = "failed"

    db.commit()


def _reload_checkout_entities(
    db: Session,
    session_id: str,
    payment_row_id: str,
) -> tuple[NewPartsCheckoutSession, YookassaPayment] | tuple[None, None]:
    session = (
        db.query(NewPartsCheckoutSession)
        .filter(NewPartsCheckoutSession.id == session_id)
        .first()
    )
    payment_row = (
        db.query(YookassaPayment).filter(YookassaPayment.id == payment_row_id).first()
    )
    if not session or not payment_row:
        return None, None
    return session, payment_row


async def _refund_after_failed_fulfillment(
    db: Session,
    session: NewPartsCheckoutSession,
    payment_row: YookassaPayment,
    *,
    reason: str,
) -> None:
    """Возврат оплаты, если заказ не удалось создать."""
    if payment_row.refund_status == "succeeded":
        session.status = "refunded"
        session.garage_order_id = None
        return

    if not payment_row.yookassa_payment_id:
        session.status = "fulfillment_failed"
        logger.error(
            "Cannot refund session %s: missing YooKassa payment id",
            session.id,
        )
        return

    client = get_yookassa_client()
    refund_body = {
        "amount": {
            "value": _format_amount(payment_row.amount_value),
            "currency": payment_row.amount_currency or "RUB",
        },
        "payment_id": payment_row.yookassa_payment_id,
        "description": reason[:250],
    }

    try:
        refund = await client.create_refund(refund_body, str(uuid.uuid4()))
        payment_row.refund_id = refund.get("id")
        payment_row.refund_status = str(refund.get("status") or "pending")
        refund_status = payment_row.refund_status

        if refund_status == "succeeded":
            session.status = "refunded"
            session.garage_order_id = None
            log_audit(
                db,
                event_type="new_parts_payment_refunded",
                category="payments",
                summary=f"Возврат после ошибки оформления (сессия {session.id[:8]})",
                user_id=session.user_id,
                details={
                    "checkout_session_id": session.id,
                    "payment_id": payment_row.yookassa_payment_id,
                    "refund_id": payment_row.refund_id,
                    "reason": reason,
                },
            )
            logger.info(
                "Refunded payment %s for session %s after fulfillment failure",
                payment_row.yookassa_payment_id,
                session.id,
            )
        elif refund_status == "canceled":
            payment_row.refund_status = "failed"
            session.status = "fulfillment_failed"
            logger.error(
                "Refund canceled for payment %s session %s",
                payment_row.yookassa_payment_id,
                session.id,
            )
        else:
            session.status = "refund_pending"
            logger.info(
                "Refund pending for payment %s session %s",
                payment_row.yookassa_payment_id,
                session.id,
            )
    except Exception:
        payment_row.refund_status = "failed"
        session.status = "fulfillment_failed"
        logger.exception(
            "Refund API failed for payment %s session %s",
            payment_row.yookassa_payment_id,
            session.id,
        )


async def _on_payment_succeeded(
    db: Session,
    session: NewPartsCheckoutSession,
    payment_row: YookassaPayment,
    api_payment: dict[str, Any],
) -> None:
    if session.status in ("fulfilled", "refunded"):
        return

    if session.garage_order_id:
        session.status = "fulfilled"
        return

    session_id = session.id
    payment_row_id = payment_row.id

    session.status = "paid"
    payment_row.status = "succeeded"

    user = db.query(UserModel).filter(UserModel.id == session.user_id).first()
    if not user:
        db.rollback()
        reloaded = _reload_checkout_entities(db, session_id, payment_row_id)
        if not reloaded[0]:
            return
        session, payment_row = reloaded
        session.status = "paid"
        payment_row.status = "succeeded"
        await _refund_after_failed_fulfillment(
            db,
            session,
            payment_row,
            reason="Не найден пользователь для оформления заказа",
        )
        return

    try:
        payload = NewPartsOrderCreateIn.model_validate_json(session.order_payload)
    except Exception:
        db.rollback()
        reloaded = _reload_checkout_entities(db, session_id, payment_row_id)
        if not reloaded[0]:
            return
        session, payment_row = reloaded
        session.status = "paid"
        payment_row.status = "succeeded"
        await _refund_after_failed_fulfillment(
            db,
            session,
            payment_row,
            reason="Некорректные данные заказа",
        )
        return

    cart_items = parse_cart_snapshot(session.cart_snapshot)
    try:
        order = await fulfill_new_parts_order(
            db,
            user=user,
            payload=payload,
            cart_items=cart_items,
            checkout_session_id=session.id,
            yookassa_payment_id=payment_row.yookassa_payment_id,
            mark_paid=True,
        )
        session.garage_order_id = order.id
        session.status = "fulfilled"
        from app.services.push_notifications import notify_sellers_new_order

        notify_sellers_new_order(
            db,
            organization_id=str(order.organization_id) if order.organization_id else None,
            order_id=order.id,
            order_kind="new",
            buyer_name=order.buyer_name,
            total_amount=float(order.total_amount) if order.total_amount is not None else None,
        )
    except HTTPException as exc:
        db.rollback()
        reloaded = _reload_checkout_entities(db, session_id, payment_row_id)
        if not reloaded[0]:
            return
        session, payment_row = reloaded
        session.status = "paid"
        payment_row.status = "succeeded"
        detail = exc.detail if isinstance(exc.detail, str) else "Ошибка оформления заказа"
        logger.error(
            "Fulfillment failed after payment %s session %s: %s",
            payment_row.yookassa_payment_id,
            session.id,
            detail,
        )
        await _refund_after_failed_fulfillment(
            db,
            session,
            payment_row,
            reason=f"Заказ не создан: {detail}",
        )
    except Exception:
        db.rollback()
        reloaded = _reload_checkout_entities(db, session_id, payment_row_id)
        if not reloaded[0]:
            return
        session, payment_row = reloaded
        session.status = "paid"
        payment_row.status = "succeeded"
        logger.exception(
            "Unexpected fulfillment error after payment %s session %s",
            payment_row.yookassa_payment_id,
            session.id,
        )
        await _refund_after_failed_fulfillment(
            db,
            session,
            payment_row,
            reason="Заказ не создан: внутренняя ошибка сервера",
        )
