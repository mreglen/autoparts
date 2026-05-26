"""Админ: настройки Rossko (доставка, оплата, контакты)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from zeep.helpers import serialize_object

from app.core.auth import get_current_admin_user
from app.core.config import Settings
from app.db.database import get_db
from app.models.user import User
from app.routers.rossko_api.rossko_api import get_details_client
from app.schemas.rossko_settings import (
    RosskoCheckoutDetailsResponse,
    RosskoSettingsResponse,
    RosskoSettingsUpdate,
)
from app.services.audit_service import log_audit
from app.services.rossko_checkout_details import get_checkout_details_error, normalize_checkout_details
from app.utils.rossko_settings_db import (
    get_rossko_settings,
    rossko_settings_configured,
    update_rossko_settings,
)

router = APIRouter(prefix="/admin/rossko", tags=["Admin Rossko"])
settings = Settings()


def _settings_to_response(row) -> RosskoSettingsResponse:
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


def _validate_settings_payload(payload: RosskoSettingsUpdate) -> None:
    if not (payload.contact_name or "").strip():
        raise HTTPException(status_code=400, detail="Укажите ФИО контакта")
    if not (payload.contact_phone or "").strip():
        raise HTTPException(status_code=400, detail="Укажите телефон контакта")
    requires_address = payload.requires_address
    if requires_address is None:
        requires_address = not bool(payload.is_pickup)
    if requires_address and not (payload.address_id or "").strip():
        raise HTTPException(status_code=400, detail="Укажите адрес доставки")
    requires_requisite = payload.requires_requisite
    if requires_requisite is None:
        requires_requisite = False
    if requires_requisite and payload.requisite_id is None:
        raise HTTPException(
            status_code=400,
            detail="Укажите реквизиты для выбранного способа оплаты (GetCheckoutDetails)",
        )


@router.get("/checkout-details", response_model=RosskoCheckoutDetailsResponse)
def admin_rossko_checkout_details(
    current_user: User = Depends(get_current_admin_user),
):
    try:
        result = get_details_client().service.GetCheckoutDetails(
            KEY1=settings.ROSSKO_KEY1,
            KEY2=settings.ROSSKO_KEY2,
        )
        serialized = serialize_object(result)
        if isinstance(serialized, dict):
            err = get_checkout_details_error(serialized)
            if err:
                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=err)
        return normalize_checkout_details(serialized)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Ошибка Rossko GetCheckoutDetails: {exc}",
        ) from exc


@router.get("/settings", response_model=RosskoSettingsResponse)
def admin_get_rossko_settings(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_rossko_settings(db)
    return _settings_to_response(row)


@router.put("/settings", response_model=RosskoSettingsResponse)
def admin_put_rossko_settings(
    payload: RosskoSettingsUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    _validate_settings_payload(payload)
    requires_address = payload.requires_address
    if requires_address is None:
        requires_address = not bool(payload.is_pickup)

    requires_requisite = payload.requires_requisite
    if requires_requisite is None:
        requires_requisite = False

    row = update_rossko_settings(
        db,
        {
            "delivery_id": payload.delivery_id,
            "address_id": payload.address_id,
            "payment_id": payload.payment_id,
            "requisite_id": payload.requisite_id,
            "contact_name": payload.contact_name.strip(),
            "contact_phone": payload.contact_phone.strip(),
            "default_comment": payload.default_comment,
            "delivery_parts": payload.delivery_parts,
            "delivery_name": payload.delivery_name,
            "address_label": payload.address_label,
            "payment_name": payload.payment_name,
            "requisite_name": payload.requisite_name,
            "is_pickup": payload.is_pickup,
            "requires_address": requires_address,
            "requires_requisite": requires_requisite,
        },
        user_id=current_user.id,
    )
    log_audit(
        db,
        event_type="rossko_settings_updated",
        category="integrations",
        summary="Настройки Rossko обновлены",
        user=current_user,
        details={
            "delivery_id": row.delivery_id,
            "payment_id": row.payment_id,
            "address_id": row.address_id,
        },
        entity_type="rossko_settings",
        entity_id=row.id,
    )
    return _settings_to_response(row)
