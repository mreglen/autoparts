"""Админ: настройки Rossko (доставка, оплата, контакты)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from zeep.helpers import serialize_object

from app.core.auth import get_current_admin_user
from app.db.database import get_db
from app.models.user import User
from app.routers.rossko_api.rossko_api import get_details_client
from app.schemas.rossko_settings import (
    RosskoCheckoutDetailsResponse,
    RosskoCredentialsUpdate,
    RosskoCredentialsView,
    RosskoMarkupSettingsResponse,
    RosskoMarkupSettingsUpdate,
    RosskoSettingsResponse,
    RosskoSettingsUpdate,
)
from app.services.audit_service import log_audit
from app.services.rossko_checkout_details import get_checkout_details_error, normalize_checkout_details
from app.utils.org_markup import (
    autoservice_markup_percent,
    buyer_markup_percent,
    global_markup_percent,
)
from app.utils.rossko_api_keys import (
    RosskoApiKeysError,
    get_rossko_api_keys,
    migrate_rossko_keys_from_env,
    rossko_api_keys_configured,
    save_rossko_api_keys,
)
from app.utils.rossko_settings_db import (
    get_rossko_settings,
    rossko_settings_configured,
    update_rossko_settings,
)
from app.utils.site_settings_db import get_or_create_site_settings

router = APIRouter(prefix="/admin/rossko", tags=["Admin Rossko"])


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
        keys_configured=rossko_api_keys_configured(row),
        updated_at=row.updated_at,
    )


def _credentials_to_response(row) -> RosskoCredentialsView:
    key1_configured = bool(getattr(row, "key1_encrypted", None))
    key2_configured = bool(getattr(row, "key2_encrypted", None))
    return RosskoCredentialsView(
        key1_configured=key1_configured,
        key2_configured=key2_configured,
        keys_configured=key1_configured and key2_configured,
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


@router.get("/credentials", response_model=RosskoCredentialsView)
def admin_get_rossko_credentials(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    migrate_rossko_keys_from_env(db)
    row = get_rossko_settings(db)
    return _credentials_to_response(row)


@router.put("/credentials", response_model=RosskoCredentialsView)
def admin_put_rossko_credentials(
    payload: RosskoCredentialsUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    try:
        save_rossko_api_keys(
            db,
            payload.key1,
            payload.key2,
            user_id=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    row = get_rossko_settings(db)
    log_audit(
        db,
        event_type="rossko_credentials_updated",
        category="integrations",
        summary="Ключи Rossko обновлены",
        user=current_user,
        entity_type="rossko_settings",
        entity_id=row.id,
    )
    return _credentials_to_response(row)


@router.get("/checkout-details", response_model=RosskoCheckoutDetailsResponse)
def admin_rossko_checkout_details(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    try:
        key1, key2 = get_rossko_api_keys(db)
        result = get_details_client().service.GetCheckoutDetails(
            KEY1=key1,
            KEY2=key2,
        )
        serialized = serialize_object(result)
        if isinstance(serialized, dict):
            err = get_checkout_details_error(serialized)
            if err:
                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=err)
        return normalize_checkout_details(serialized)
    except RosskoApiKeysError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
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
    del current_user
    migrate_rossko_keys_from_env(db)
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


def _markup_settings_to_response(row) -> RosskoMarkupSettingsResponse:
    return RosskoMarkupSettingsResponse(
        buyer_markup_percent=buyer_markup_percent(row),
        seller_markup_percent=global_markup_percent(row),
        autoservice_markup_percent=autoservice_markup_percent(row),
    )


@router.get("/markup-settings", response_model=RosskoMarkupSettingsResponse)
def admin_get_rossko_markup_settings(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    row = get_or_create_site_settings(db)
    return _markup_settings_to_response(row)


@router.put("/markup-settings", response_model=RosskoMarkupSettingsResponse)
def admin_put_rossko_markup_settings(
    payload: RosskoMarkupSettingsUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_site_settings(db)
    row.buyer_new_parts_markup_percent = float(payload.buyer_markup_percent)
    row.new_parts_markup_percent = float(payload.seller_markup_percent)
    row.autoservice_new_parts_markup_percent = float(payload.autoservice_markup_percent)
    db.commit()
    db.refresh(row)
    log_audit(
        db,
        event_type="rossko_markup_settings_updated",
        category="integrations",
        summary="Наценки Rossko/автосервиса обновлены",
        user=current_user,
        details={
            "buyer_markup_percent": row.buyer_new_parts_markup_percent,
            "seller_markup_percent": row.new_parts_markup_percent,
            "autoservice_markup_percent": row.autoservice_new_parts_markup_percent,
        },
        entity_type="site_settings",
        entity_id=row.id,
    )
    return _markup_settings_to_response(row)
