"""Оформление заказов новых запчастей (Rossko GetCheckout на бэкенде, без упоминания поставщика покупателю)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.carts import NewPartsCart
from app.models.garage_new_orders import GarageNewOrder, GarageNewOrderItem
from app.models.organization import Organization
from app.models.user import User as UserModel
from app.schemas.rossko_settings import (
    NewPartsOrderCreateIn,
    NewPartsOrderCreateOut,
    RosskoSettingsResponse,
)
from app.utils.rossko_settings_db import rossko_settings_configured
from app.services.audit_service import log_audit
from app.services.rossko_order_service import (
    build_checkout_payload,
    extract_rossko_notice_message,
    extract_rossko_order_id,
    send_checkout_to_rossko,
    serialize_rossko_response,
)
from app.utils.guest_cart import get_or_create_user_cart
from app.utils.rossko_settings_db import get_rossko_settings

router = APIRouter(prefix="/orders", tags=["Orders New Parts"])


def _settings_to_public(row) -> RosskoSettingsResponse:
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
    )


@router.get("/new-parts/config", response_model=RosskoSettingsResponse)
def get_new_parts_checkout_config(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    row = get_rossko_settings(db)
    return _settings_to_public(row)


@router.post("/new-parts", response_model=NewPartsOrderCreateOut)
async def create_new_parts_order(
    payload: NewPartsOrderCreateIn | None = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
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

    admin_user = db.query(UserModel).filter(UserModel.is_admin == True).first()
    organization_id = None
    if admin_user and admin_user.organization_id:
        organization_id = admin_user.organization_id
    elif current_user.organization_id:
        organization_id = current_user.organization_id
    if not organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не настроена организация для заказов новых запчастей",
        )

    org = db.query(Organization).filter(Organization.id == organization_id).first()
    seller_name = org.name if org and org.name else None

    cart = get_or_create_user_cart(db, current_user.id)
    cart_items = (
        db.query(NewPartsCart)
        .filter(NewPartsCart.cart_id == cart.id, NewPartsCart.user_id == current_user.id)
        .all()
    )
    if not cart_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="В корзине нет новых запчастей",
        )

    rossko_cfg = get_rossko_settings(db)
    checkout_payload = build_checkout_payload(
        cart_items,
        rossko_cfg,
        comment=payload.comment,
        delivery_parts=payload.deliver_in_parts,
    )

    try:
        rossko_response = await send_checkout_to_rossko(checkout_payload)
    except HTTPException as exc:
        log_audit(
            db,
            event_type="rossko_order_failed",
            category="orders",
            summary="Ошибка оформления заказа новых запчастей (поставщик)",
            user=current_user,
            organization_id=organization_id,
            details={"detail": exc.detail},
        )
        db.commit()
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
        user_id=current_user.id,
        buyer_name=(payload.recipient_name or "").strip(),
        buyer_phone=(payload.recipient_phone or "").strip(),
        buyer_email=(payload.recipient_email or current_user.email or "").strip(),
        delivery_type=delivery_type,
        delivery_address=delivery_address,
        transport_company=transport_company,
        pickup_address=pickup_address,
        delivery_region_id=payload.delivery_region_id,
        delivery_region_name=payload.delivery_region_name,
        total_amount=total_amount,
        is_paid=False,
        status_code="pending",
        seller=seller_name,
        deliver_in_parts=bool(payload.deliver_in_parts),
        rossko_order_id=rossko_order_id,
        rossko_response_raw=serialize_rossko_response(rossko_response),
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
                status_code="pending",
            )
        )

    item_ids = [item.id for item in cart_items]
    db.query(NewPartsCart).filter(NewPartsCart.id.in_(item_ids)).delete(synchronize_session=False)

    log_audit(
        db,
        event_type="rossko_order_created",
        category="orders",
        summary=f"Заказ новых запчастей #{new_order.id} оформлен",
        user=current_user,
        organization_id=organization_id,
        details={
            "order_id": new_order.id,
            "rossko_order_id": rossko_order_id,
            "items_count": len(cart_items),
            "total_amount": total_amount,
        },
        entity_type="garage_new_order",
        entity_id=new_order.id,
    )

    db.commit()

    success_message = f"Заказ №{new_order.id} оформлен"
    rossko_notice = extract_rossko_notice_message(rossko_response)
    if rossko_notice:
        success_message = f"{success_message}. {rossko_notice}"

    return NewPartsOrderCreateOut(
        ok=True,
        order_id=new_order.id,
        message=success_message,
    )
