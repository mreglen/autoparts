"""Оформление заказов новых запчастей (Rossko GetCheckout на бэкенде, без упоминания поставщика покупателю)."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.carts.new_parts_cart import NewPartsCart
from app.models.user import User as UserModel
from app.schemas.rossko_settings import (
    NewPartsOrderCreateIn,
    NewPartsOrderCreateOut,
    RosskoSettingsResponse,
)
from app.utils.rossko_settings_db import get_rossko_settings, rossko_settings_configured
from app.utils.unpaid_checkout import user_allows_unpaid_checkout
from app.services.new_parts_order_fulfillment import fulfill_new_parts_order
from app.services.push_notifications import notify_sellers_new_order
from app.services.rossko_order_service import extract_rossko_notice_message
from app.utils.guest_cart import get_or_create_user_cart
from app.utils.cart_baskets import load_user_basket_items

router = APIRouter(prefix="/orders", tags=["Orders New Parts"])


def _settings_to_public(row, *, allow_unpaid_checkout: bool = False) -> RosskoSettingsResponse:
    return RosskoSettingsResponse(
        delivery_id=row.delivery_id,
        address_id=row.address_id,
        payment_id=row.payment_id,
        requisite_id=row.requisite_id,
        contact_name=row.contact_name or "",
        contact_phone=row.contact_phone or "",
        default_comment=row.default_comment,
        delivery_parts=bool(row.delivery_parts),
        delivery_name=row.delivery_name,
        address_label=row.address_label,
        payment_name=row.payment_name,
        requisite_name=row.requisite_name,
        is_pickup=row.is_pickup,
        requires_address=row.requires_address,
        requires_requisite=row.requires_requisite,
        configured=rossko_settings_configured(row),
        updated_at=row.updated_at,
        allow_unpaid_checkout=bool(allow_unpaid_checkout),
    )


@router.get("/new-parts/config", response_model=RosskoSettingsResponse)
def get_new_parts_checkout_config(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    row = get_rossko_settings(db)
    return _settings_to_public(
        row,
        allow_unpaid_checkout=user_allows_unpaid_checkout(db, current_user),
    )


@router.post("/new-parts", response_model=NewPartsOrderCreateOut)
async def create_new_parts_order(
    payload: NewPartsOrderCreateIn | None = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    if not user_allows_unpaid_checkout(db, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Оформление без оплаты недоступно для вашей организации",
        )

    payload = payload or NewPartsOrderCreateIn()

    if not (payload.recipient_name or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Укажите ФИО получателя",
        )
    if not (payload.recipient_phone or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Укажите телефон получателя",
        )

    cart = get_or_create_user_cart(db, current_user.id)
    cart_items = load_user_basket_items(
        db,
        cart.id,
        current_user.id,
        payload.basket_id,
    )
    if not cart_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="В корзине нет новых запчастей",
        )

    new_order = await fulfill_new_parts_order(
        db,
        user=current_user,
        payload=payload,
        cart_items=cart_items,
        mark_paid=False,
    )
    db.commit()
    db.refresh(new_order)

    notify_sellers_new_order(
        db,
        organization_id=str(new_order.organization_id) if new_order.organization_id else None,
        order_id=new_order.id,
        order_kind="new",
        buyer_name=new_order.buyer_name,
        total_amount=float(new_order.total_amount) if new_order.total_amount is not None else None,
    )

    rossko_response = None
    if new_order.rossko_response_raw:
        try:
            rossko_response = json.loads(new_order.rossko_response_raw)
        except json.JSONDecodeError:
            rossko_response = None

    success_message = f"Заказ №{new_order.id} оформлен"
    rossko_notice = extract_rossko_notice_message(rossko_response)
    if rossko_notice:
        success_message = f"{success_message}. {rossko_notice}"

    return NewPartsOrderCreateOut(
        ok=True,
        order_id=new_order.id,
        message=success_message,
    )
