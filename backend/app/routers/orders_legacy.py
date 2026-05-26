from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.carts import NewPartsCart
from app.models.garage_new_orders import GarageNewOrder, GarageNewOrderItem
from app.models.user import User as UserModel
from app.services.marketplace_used_order import (
    UsedOrderDeliveryInput,
    UsedOrderItemInput,
    create_used_orders_from_payload,
)
from app.services.audit_service import log_audit

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
    delivery_region_id: Optional[int] = None
    delivery_region_name: Optional[str] = None
    delivery_option_id: Optional[int] = None
    total_amount: float = Field(default=0, ge=0)


class CreatedUsedOrderOut(BaseModel):
    id: int
    organization_id: str
    total_amount: float


class LegacyCreateOrderOut(BaseModel):
    ok: bool = True
    new_order_id: Optional[int] = None
    used_order_id: Optional[int] = None
    used_orders: list[CreatedUsedOrderOut] = Field(default_factory=list)


def _to_used_item_inputs(items: list[LegacyOrderItemIn]) -> list[UsedOrderItemInput]:
    return [
        UsedOrderItemInput(
            name=item.name,
            brand=item.brand,
            partnumber=item.partnumber,
            quantity=item.quantity,
            price=float(item.price),
            product_id=item.product_id,
        )
        for item in items
    ]


def _delivery_from_payload(payload: LegacyCreateOrderIn) -> UsedOrderDeliveryInput:
    return UsedOrderDeliveryInput(
        buyer_name=payload.recipient_name,
        buyer_phone=payload.recipient_phone,
        buyer_email=payload.recipient_email or "",
        delivery_type=payload.delivery_type,
        delivery_address=payload.delivery_address,
        transport_company=payload.transport_company,
        pickup_address=payload.pickup_address,
        delivery_region_id=payload.delivery_region_id,
        delivery_region_name=payload.delivery_region_name,
    )


@router.post("/", response_model=LegacyCreateOrderOut)
def create_order_legacy(
    payload: LegacyCreateOrderIn,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """
    Compatibility endpoint for old frontend OrderRegistration page.
    Saves orders into new garage_* tables so /sales pages can display them.
    """
    if not payload.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Список товаров пуст",
        )

    if len(payload.cart_item_ids) > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Новые запчасти оформляются через POST /orders/new-parts",
        )

    create_new = False
    create_used = len(payload.used_cart_item_ids) > 0
    if not create_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Укажите позиции б/у в корзине (used_cart_item_ids)",
        )

    created_new_id: Optional[int] = None
    used_orders_out: list[CreatedUsedOrderOut] = []

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
            delivery_region_id=payload.delivery_region_id,
            delivery_region_name=payload.delivery_region_name,
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
        created_new_id = new_order.id

        db.query(NewPartsCart).filter(
            NewPartsCart.user_id == current_user.id,
            NewPartsCart.id.in_(payload.cart_item_ids),
        ).delete(synchronize_session=False)

    if create_used:
        used_items = _to_used_item_inputs(payload.items)
        summaries = create_used_orders_from_payload(
            db,
            current_user=current_user,
            items=used_items,
            delivery=_delivery_from_payload(payload),
            used_cart_item_ids=payload.used_cart_item_ids,
        )
        used_orders_out = [
            CreatedUsedOrderOut(
                id=s.id,
                organization_id=s.organization_id,
                total_amount=s.total_amount,
            )
            for s in summaries
        ]

    db.commit()

    if used_orders_out:
        for o in used_orders_out:
            log_audit(
                db,
                event_type="order_created",
                category="orders",
                summary=f"Создан заказ Б/У #{o.id}, org {o.organization_id}",
                user=current_user,
                organization_id=o.organization_id,
                details={"order_id": o.id, "total_amount": o.total_amount},
                entity_type="garage_used_order",
                entity_id=o.id,
            )
    if created_new_id:
        log_audit(
            db,
            event_type="order_created",
            category="orders",
            summary=f"Создан заказ новых запчастей #{created_new_id}",
            user=current_user,
            organization_id=current_user.organization_id,
            details={"order_id": created_new_id},
            entity_type="garage_new_order",
            entity_id=created_new_id,
        )

    used_order_id = used_orders_out[0].id if used_orders_out else None

    return LegacyCreateOrderOut(
        ok=True,
        new_order_id=created_new_id,
        used_order_id=used_order_id,
        used_orders=used_orders_out,
    )
