"""Оплата заказов новых запчастей через ЮKassa."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.user import User as UserModel
from app.schemas.yookassa_payments import (
    CardPaymentOut,
    NewPartsPaymentSessionCreateIn,
    NewPartsPaymentSessionOut,
)
from app.services.new_parts_payment_service import (
    create_card_payment,
    create_checkout_session,
    get_session_for_user,
    handle_yookassa_webhook,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Payments New Parts"])


@router.post(
    "/payments/new-parts/sessions",
    response_model=NewPartsPaymentSessionOut,
)
async def start_new_parts_payment_session(
    payload: NewPartsPaymentSessionCreateIn,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    data = await create_checkout_session(db, current_user, payload)
    return NewPartsPaymentSessionOut(**data)


@router.get(
    "/payments/new-parts/sessions/{session_id}",
    response_model=NewPartsPaymentSessionOut,
)
async def get_new_parts_payment_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    data = await get_session_for_user(db, current_user, session_id)
    return NewPartsPaymentSessionOut(**data)


@router.post(
    "/payments/new-parts/sessions/{session_id}/card",
    response_model=CardPaymentOut,
)
async def start_card_payment_for_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    data = await create_card_payment(db, current_user, session_id)
    return CardPaymentOut(**data)


@router.post("/payments/yookassa/webhook")
async def yookassa_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    try:
        body = await request.json()
    except Exception:
        logger.warning("YooKassa webhook: invalid JSON")
        return {"ok": False}

    if not isinstance(body, dict):
        return {"ok": False}

    try:
        await handle_yookassa_webhook(db, body)
    except Exception:
        logger.exception("YooKassa webhook processing error")
    return {"ok": True}
