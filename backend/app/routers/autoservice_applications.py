"""Заявки организаций на подключение тарифа автосервиса."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_tariff_application import AutoserviceTariffApplication
from app.models.organization import Organization
from app.models.user import User
from app.schemas.autoservice_tariff_application import (
    AutoserviceTariffApplicationCreate,
    AutoserviceTariffApplicationOut,
)
from app.utils.org_markup import autoservice_markup_percent
from app.utils.phone import normalize_to_storage_format
from app.utils.site_settings_db import get_or_create_site_settings

router = APIRouter(prefix="/autoservice/applications", tags=["Autoservice Applications"])

TARIFF_PRICE_RUB = 10_000


def _user_display(user: User | None) -> str | None:
    if not user:
        return None
    parts = [user.last_name or "", user.first_name or "", user.patronymic or ""]
    name = " ".join(p for p in parts if p).strip()
    return name or user.email


def _serialize_application(db: Session, row: AutoserviceTariffApplication) -> dict:
    org = db.query(Organization).filter(Organization.id == row.organization_id).first()
    applicant = db.query(User).filter(User.id == row.applicant_user_id).first()
    return AutoserviceTariffApplicationOut(
        id=row.id,
        organization_id=row.organization_id,
        organization_name=org.name if org else None,
        applicant_user_id=row.applicant_user_id,
        applicant_name=_user_display(applicant),
        contact_name=row.contact_name,
        contact_phone=row.contact_phone,
        message=row.message,
        status=row.status,
        rejection_reason=row.rejection_reason,
        reviewed_at=row.reviewed_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
        organization_is_autoservice=bool(getattr(org, "is_autoservice", False)) if org else False,
    ).model_dump()


@router.get("/tariff-info")
def get_autoservice_tariff_info(db: Session = Depends(get_db)):
    settings_row = get_or_create_site_settings(db)
    return {
        "price_rub_per_month": TARIFF_PRICE_RUB,
        "autoservice_markup_percent": autoservice_markup_percent(settings_row),
    }


@router.get("/me")
def get_my_autoservice_application(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="У пользователя нет организации")
    org = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Организация не найдена")

    row = (
        db.query(AutoserviceTariffApplication)
        .filter(AutoserviceTariffApplication.organization_id == current_user.organization_id)
        .order_by(AutoserviceTariffApplication.created_at.desc())
        .first()
    )
    settings_row = get_or_create_site_settings(db)
    return {
        "organization_is_autoservice": bool(org.is_autoservice),
        "application": _serialize_application(db, row) if row else None,
        "price_rub_per_month": TARIFF_PRICE_RUB,
        "autoservice_markup_percent": autoservice_markup_percent(settings_row),
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def submit_autoservice_application(
    payload: AutoserviceTariffApplicationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.is_director:
        raise HTTPException(status_code=403, detail="Заявку может отправить только директор организации")
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="У пользователя нет организации")

    org = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Организация не найдена")
    if org.is_autoservice:
        raise HTTPException(status_code=400, detail="Автосервис уже подключён")

    pending = (
        db.query(AutoserviceTariffApplication)
        .filter(
            AutoserviceTariffApplication.organization_id == org.id,
            AutoserviceTariffApplication.status == "pending",
        )
        .first()
    )
    if pending:
        raise HTTPException(status_code=400, detail="Заявка уже отправлена и ожидает рассмотрения")

    phone = normalize_to_storage_format(payload.contact_phone)
    if not phone:
        raise HTTPException(status_code=400, detail="Неверный формат телефона")

    row = AutoserviceTariffApplication(
        organization_id=org.id,
        applicant_user_id=current_user.id,
        contact_name=payload.contact_name.strip(),
        contact_phone=phone,
        message=(payload.message or "").strip() or None,
        status="pending",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize_application(db, row)
