"""Оформление заказа новых запчастей в Rossko и локальной БД после оплаты."""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.carts.new_parts_cart import NewPartsCart
from app.models.garage_new_orders import GarageNewOrder, GarageNewOrderItem
from app.models.organization import Organization
from app.models.user import User as UserModel
from app.schemas.rossko_settings import NewPartsOrderCreateIn
from app.services.audit_service import log_audit
from app.services.rossko_order_service import (
    build_checkout_payload,
    extract_rossko_notice_message,
    extract_rossko_order_id,
    send_checkout_to_rossko,
    serialize_rossko_response,
)
from app.utils.rossko_settings_db import get_rossko_settings


@dataclass
class SnapshotCartItem:
    id: int | None
    brand: str
    partnumber: str
    name: str | None
    quantity: int
    price: float
    stock_id: str

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> SnapshotCartItem:
        return cls(
            id=data.get("id"),
            brand=str(data.get("brand") or ""),
            partnumber=str(data.get("partnumber") or ""),
            name=data.get("name"),
            quantity=int(data.get("quantity") or 1),
            price=float(data.get("price") or 0),
            stock_id=str(data.get("stock_id") or ""),
        )


def parse_cart_snapshot(raw: str) -> list[SnapshotCartItem]:
    try:
        data = json.loads(raw or "[]")
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    return [SnapshotCartItem.from_dict(row) for row in data if isinstance(row, dict)]


def _resolve_organization_id(db: Session, user: UserModel) -> str:
    admin_user = db.query(UserModel).filter(UserModel.is_admin == True).first()
    if admin_user and admin_user.organization_id:
        return admin_user.organization_id
    if user.organization_id:
        return user.organization_id
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Не настроена организация для заказов новых запчастей",
    )


async def fulfill_new_parts_order(
    db: Session,
    *,
    user: UserModel,
    payload: NewPartsOrderCreateIn,
    cart_items: list[SnapshotCartItem | NewPartsCart],
    checkout_session_id: str | None = None,
    yookassa_payment_id: str | None = None,
    mark_paid: bool = True,
) -> GarageNewOrder:
    if not cart_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="В корзине нет новых запчастей",
        )

    organization_id = _resolve_organization_id(db, user)
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    seller_name = org.name if org and org.name else None

    rossko_cfg = get_rossko_settings(db)
    checkout_payload = build_checkout_payload(
        cart_items,
        rossko_cfg,
        comment=payload.comment,
        delivery_parts=payload.deliver_in_parts,
    )

    new_order: GarageNewOrder | None = None
    try:
        try:
            rossko_response = await send_checkout_to_rossko(checkout_payload)
        except HTTPException as exc:
            log_audit(
                db,
                event_type="rossko_order_failed",
                category="orders",
                summary="Ошибка оформления заказа новых запчастей (поставщик)",
                user=user,
                organization_id=organization_id,
                details={"detail": exc.detail, "checkout_session_id": checkout_session_id},
            )
            db.flush()
            raise

        rossko_order_id = extract_rossko_order_id(rossko_response)
        total_amount = sum(float(item.price) * int(item.quantity) for item in cart_items)

        delivery_type = (payload.delivery_type or "transport").strip() or "transport"
        delivery_address = payload.delivery_address
        transport_company = payload.transport_company
        pickup_address = payload.pickup_address
        if delivery_type == "pickup" and not pickup_address:
            pickup_address = org.address if org and org.address else None

        new_order = GarageNewOrder(
            organization_id=organization_id,
            user_id=user.id,
            buyer_name=(payload.recipient_name or "").strip(),
            buyer_phone=(payload.recipient_phone or "").strip(),
            buyer_email=(payload.recipient_email or user.email or "").strip(),
            delivery_type=delivery_type,
            delivery_address=delivery_address,
            transport_company=transport_company,
            pickup_address=pickup_address,
            delivery_region_id=payload.delivery_region_id,
            delivery_region_name=payload.delivery_region_name,
            total_amount=total_amount,
            is_paid=bool(mark_paid),
            status_code="new_waiting_confirmation",
            seller=seller_name,
            deliver_in_parts=bool(payload.deliver_in_parts),
            rossko_order_id=rossko_order_id,
            rossko_response_raw=serialize_rossko_response(rossko_response),
            checkout_session_id=checkout_session_id,
            yookassa_payment_id=yookassa_payment_id,
        )
        db.add(new_order)
        db.flush()

        for item in cart_items:
            db.add(
                GarageNewOrderItem(
                    order_id=new_order.id,
                    name=item.name or f"{item.brand} {item.partnumber}",
                    brand=item.brand,
                    partnumber=item.partnumber,
                    quantity=int(item.quantity),
                    price=float(item.price),
                    status_code="new_waiting_confirmation",
                )
            )

        cart_ids = [item.id for item in cart_items if getattr(item, "id", None)]
        if cart_ids:
            db.query(NewPartsCart).filter(NewPartsCart.id.in_(cart_ids)).delete(
                synchronize_session=False
            )

        log_audit(
            db,
            event_type="rossko_order_created",
            category="orders",
            summary=f"Заказ новых запчастей #{new_order.id} оформлен",
            user=user,
            organization_id=organization_id,
            details={
                "order_id": new_order.id,
                "rossko_order_id": rossko_order_id,
                "items_count": len(cart_items),
                "total_amount": total_amount,
                "checkout_session_id": checkout_session_id,
                "yookassa_payment_id": yookassa_payment_id,
            },
            entity_type="garage_new_order",
            entity_id=new_order.id,
        )

        db.flush()
        return new_order
    except Exception:
        if new_order is not None and new_order.id is not None:
            db.query(GarageNewOrderItem).filter(
                GarageNewOrderItem.order_id == new_order.id
            ).delete(synchronize_session=False)
            db.delete(new_order)
            db.flush()
        raise
