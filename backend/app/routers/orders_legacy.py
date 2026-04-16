from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.carts import NewPartsCart, UsedPartsCart
from app.models.garage_new_orders import GarageNewOrder, GarageNewOrderItem
from app.models.garage_used_orders import GarageUsedOrder, GarageUsedOrderItem
from app.models.user import User as UserModel


router = APIRouter(prefix="/orders", tags=["Orders Legacy"])


class LegacyOrderItemIn(BaseModel):
    name: str
    brand: Optional[str] = None
    partnumber: Optional[str] = None
    quantity: int = Field(default=1, ge=1)
    price: float = Field(default=0, ge=0)
    product_id: Optional[int] = None


class LegacyNewPartsOrderIn(BaseModel):
    seller: Optional[str] = None
    deliver_in_parts: bool = False


class LegacyCreateOrderIn(BaseModel):
    items: list[LegacyOrderItemIn]
    cart_item_ids: list[int] = Field(default_factory=list)
    used_cart_item_ids: list[int] = Field(default_factory=list)
    new_parts_order: Optional[LegacyNewPartsOrderIn] = None
    recipient_name: str
    recipient_phone: str
    recipient_email: str = ""
    delivery_type: str = "transport"
    delivery_address: Optional[str] = None
    transport_company: Optional[str] = None
    pickup_address: Optional[str] = None
    total_amount: float = Field(default=0, ge=0)


@router.post("/")
def create_order_legacy(
    payload: LegacyCreateOrderIn,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """
    Compatibility endpoint for old frontend OrderRegistration page.
    Saves orders into new garage_* tables so /sales pages can display them.
    """
    if not current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь не привязан к организации",
        )
    if not payload.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Список товаров пуст",
        )

    # Heuristic split:
    # - if cart_item_ids exists -> create New order
    # - if used_cart_item_ids exists -> create Used order
    # - if both empty -> fallback to Used order
    create_new = len(payload.cart_item_ids) > 0
    create_used = len(payload.used_cart_item_ids) > 0 or not create_new

    created = {"new_order_id": None, "used_order_id": None}

    if create_new:
        new_order = GarageNewOrder(
            organization_id=current_user.organization_id,
            buyer_name=payload.recipient_name,
            buyer_phone=payload.recipient_phone,
            buyer_email=payload.recipient_email or "",
            delivery_type=payload.delivery_type,
            delivery_address=payload.delivery_address,
            transport_company=payload.transport_company,
            pickup_address=payload.pickup_address,
            total_amount=float(payload.total_amount or 0),
            is_paid=False,
            status_code="pending",
            seller=(payload.new_parts_order.seller if payload.new_parts_order else None),
            deliver_in_parts=bool(payload.new_parts_order.deliver_in_parts) if payload.new_parts_order else False,
        )
        db.add(new_order)
        db.flush()
        for item in payload.items:
            db.add(
                GarageNewOrderItem(
                    order_id=new_order.id,
                    name=item.name,
                    brand=item.brand,
                    partnumber=item.partnumber,
                    quantity=item.quantity,
                    price=float(item.price),
                    status_code="pending",
                )
            )
        created["new_order_id"] = new_order.id

    if create_used:
        used_order = GarageUsedOrder(
            organization_id=current_user.organization_id,
            buyer_name=payload.recipient_name,
            buyer_phone=payload.recipient_phone,
            buyer_email=payload.recipient_email or "",
            delivery_type=payload.delivery_type,
            delivery_address=payload.delivery_address,
            transport_company=payload.transport_company,
            pickup_address=payload.pickup_address,
            total_amount=float(payload.total_amount or 0),
            is_paid=False,
            status_code="pending",
        )
        db.add(used_order)
        db.flush()
        for item in payload.items:
            db.add(
                GarageUsedOrderItem(
                    order_id=used_order.id,
                    product_id=item.product_id,
                    name=item.name,
                    brand=item.brand,
                    partnumber=item.partnumber,
                    quantity=item.quantity,
                    price=float(item.price),
                    status_code="pending",
                )
            )
        created["used_order_id"] = used_order.id

    # Remove ordered positions from cart (only current user's rows).
    if payload.cart_item_ids:
        db.query(NewPartsCart).filter(
            NewPartsCart.user_id == current_user.id,
            NewPartsCart.id.in_(payload.cart_item_ids),
        ).delete(synchronize_session=False)

    if payload.used_cart_item_ids:
        db.query(UsedPartsCart).filter(
            UsedPartsCart.user_id == current_user.id,
            UsedPartsCart.id.in_(payload.used_cart_item_ids),
        ).delete(synchronize_session=False)

    db.commit()
    return {"ok": True, **created}

