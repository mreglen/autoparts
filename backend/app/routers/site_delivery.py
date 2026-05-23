from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin_user
from app.db.database import get_db
from app.models.site_delivery_option import SiteDeliveryOption
from app.models.user import User
from app.schemas.site_delivery import (
    DELIVERY_TYPES,
    SiteDeliveryOptionCreate,
    SiteDeliveryOptionUpdate,
    SiteDeliveryOptionView,
    SitePaymentInfoView,
)
from app.services.audit_service import log_audit
from app.services.site_delivery_service import (
    DELIVERY_TYPE_LABELS,
    PAYMENT_METHODS,
    PAYMENT_NOTES,
    ensure_default_delivery_options,
    list_delivery_options,
    region_ids_csv_from_delivery,
)
from app.services.yandex_feed_sync_service import normalize_region_ids_csv
from app.utils.yandex_integration_db import get_or_create_yandex_integration

router = APIRouter(tags=["Site delivery"])


def _validate_delivery_type(value: str) -> str:
    normalized = (value or "").strip().lower()
    if normalized not in DELIVERY_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"delivery_type должен быть одним из: {', '.join(sorted(DELIVERY_TYPES))}",
        )
    return normalized


@router.get("/public/site-delivery", response_model=list[SiteDeliveryOptionView])
def get_public_site_delivery(db: Session = Depends(get_db)):
    rows = list_delivery_options(db, enabled_only=True)
    return rows


@router.get("/public/site-payment", response_model=SitePaymentInfoView)
def get_public_site_payment():
    return SitePaymentInfoView(methods=PAYMENT_METHODS, notes=PAYMENT_NOTES)


@router.get("/admin/site-delivery", response_model=list[SiteDeliveryOptionView])
def get_admin_site_delivery(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    return list_delivery_options(db, enabled_only=False)


@router.post("/admin/site-delivery", response_model=SiteDeliveryOptionView)
def create_site_delivery_option(
    payload: SiteDeliveryOptionCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = SiteDeliveryOption(
        region_id=int(payload.region_id),
        region_name=payload.region_name.strip(),
        delivery_type=_validate_delivery_type(payload.delivery_type),
        carrier=(payload.carrier or "").strip() or None,
        pickup_point=(payload.pickup_point or "").strip() or None,
        min_order_amount=payload.min_order_amount,
        enabled=bool(payload.enabled),
        sort_order=int(payload.sort_order),
        notes=(payload.notes or "").strip() or None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    log_audit(
        db,
        event_type="site_delivery_option_created",
        category="settings",
        summary=f"Добавлен способ доставки: {row.region_name} / {row.delivery_type}",
        user=current_user,
    )
    return row


@router.patch("/admin/site-delivery/{option_id}", response_model=SiteDeliveryOptionView)
def update_site_delivery_option(
    option_id: int,
    payload: SiteDeliveryOptionUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = db.query(SiteDeliveryOption).filter(SiteDeliveryOption.id == option_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Способ доставки не найден")

    data = payload.model_dump(exclude_unset=True)
    if "delivery_type" in data and data["delivery_type"] is not None:
        data["delivery_type"] = _validate_delivery_type(data["delivery_type"])
    if "region_name" in data and data["region_name"] is not None:
        data["region_name"] = data["region_name"].strip()
    if "carrier" in data:
        data["carrier"] = (data.get("carrier") or "").strip() or None
    if "pickup_point" in data:
        data["pickup_point"] = (data.get("pickup_point") or "").strip() or None
    if "notes" in data:
        data["notes"] = (data.get("notes") or "").strip() or None

    for key, value in data.items():
        setattr(row, key, value)
    db.add(row)
    db.commit()
    db.refresh(row)
    log_audit(
        db,
        event_type="site_delivery_option_updated",
        category="settings",
        summary=f"Обновлён способ доставки #{row.id}",
        user=current_user,
    )
    return row


@router.delete("/admin/site-delivery/{option_id}")
def delete_site_delivery_option(
    option_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = db.query(SiteDeliveryOption).filter(SiteDeliveryOption.id == option_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Способ доставки не найден")
    db.delete(row)
    db.commit()
    log_audit(
        db,
        event_type="site_delivery_option_deleted",
        category="settings",
        summary=f"Удалён способ доставки #{option_id}",
        user=current_user,
    )
    return {"ok": True}


@router.post("/admin/site-delivery/sync-yandex-regions")
def sync_yandex_regions_from_delivery(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    integration = get_or_create_yandex_integration(db)
    csv_value = region_ids_csv_from_delivery(db)
    integration.region_ids_csv = normalize_region_ids_csv(csv_value)
    db.add(integration)
    db.commit()
    db.refresh(integration)
    return {
        "ok": True,
        "region_ids_csv": integration.region_ids_csv,
        "delivery_type_labels": DELIVERY_TYPE_LABELS,
    }


@router.post("/admin/site-delivery/ensure-defaults")
def ensure_defaults(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    ensure_default_delivery_options(db)
    return {"ok": True, "count": db.query(SiteDeliveryOption).count()}
