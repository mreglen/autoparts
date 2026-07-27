from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, get_current_user_optional
from app.db.database import get_db
from app.models.inspection_booking import InspectionBooking
from app.models.user import User
from app.schemas.inspection_booking import (
    InspectionBookingPatch,
    InspectionBookingPublicCreate,
    InspectionBookingStaffCreate,
    InspectionBookingView,
)
from app.utils.org_access import resolve_autoservice_organization_id
from app.utils.phone import normalize_to_storage_format
from app.utils.site_settings_db import autoservice_enabled

router = APIRouter(tags=["Autoservice inspections"])

VALID_STATUSES = frozenset({"new", "processed", "cancelled"})


def _require_autoservice_enabled(db: Session) -> None:
    if not autoservice_enabled(db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Автосервис временно отключён",
        )


def _require_autoservice_org_id(db: Session) -> str:
    org_id = resolve_autoservice_organization_id(db)
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Организация автосервиса не настроена",
        )
    return org_id


def _require_autoservice_staff(db: Session, user: User) -> str:
    _require_autoservice_enabled(db)
    org_id = _require_autoservice_org_id(db)
    if not user.organization_id or user.organization_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нет доступа к записям автосервиса",
        )
    if not (user.is_admin or user.is_director or user.is_seller or user.is_employee):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нет доступа к записям автосервиса",
        )
    return org_id


def _normalize_phone_or_400(phone: str) -> str:
    normalized = normalize_to_storage_format(phone)
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный формат телефона",
        )
    return normalized


@router.post(
    "/public/autoservice/inspection-bookings",
    response_model=InspectionBookingView,
    status_code=status.HTTP_201_CREATED,
)
def create_public_inspection_booking(
    payload: InspectionBookingPublicCreate,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    _require_autoservice_enabled(db)
    org_id = _require_autoservice_org_id(db)
    phone = _normalize_phone_or_400(payload.phone)
    row = InspectionBooking(
        organization_id=org_id,
        name=payload.name.strip(),
        phone=phone,
        preferred_date=payload.preferred_date,
        status="new",
        source="site",
        created_by_user_id=current_user.id if current_user else None,
        notes=None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return InspectionBookingView.model_validate(row)


@router.get(
    "/autoservice/inspection-bookings",
    response_model=list[InspectionBookingView],
)
def list_inspection_bookings(
    status_filter: str | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = _require_autoservice_staff(db, current_user)
    q = db.query(InspectionBooking).filter(InspectionBooking.organization_id == org_id)
    if status_filter:
        if status_filter not in VALID_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Недопустимый статус",
            )
        q = q.filter(InspectionBooking.status == status_filter)
    rows = q.order_by(InspectionBooking.created_at.desc(), InspectionBooking.id.desc()).all()
    return [InspectionBookingView.model_validate(row) for row in rows]


@router.post(
    "/autoservice/inspection-bookings",
    response_model=InspectionBookingView,
    status_code=status.HTTP_201_CREATED,
)
def create_staff_inspection_booking(
    payload: InspectionBookingStaffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = _require_autoservice_staff(db, current_user)
    phone = _normalize_phone_or_400(payload.phone)
    notes = (payload.notes or "").strip() or None
    row = InspectionBooking(
        organization_id=org_id,
        name=payload.name.strip(),
        phone=phone,
        preferred_date=payload.preferred_date,
        status="new",
        source="staff",
        created_by_user_id=current_user.id,
        notes=notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return InspectionBookingView.model_validate(row)


@router.patch(
    "/autoservice/inspection-bookings/{booking_id}",
    response_model=InspectionBookingView,
)
def patch_inspection_booking(
    booking_id: int,
    payload: InspectionBookingPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = _require_autoservice_staff(db, current_user)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нет полей для обновления",
        )
    row = (
        db.query(InspectionBooking)
        .filter(
            InspectionBooking.id == booking_id,
            InspectionBooking.organization_id == org_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заявка не найдена",
        )
    if "status" in data and data["status"] is not None:
        if data["status"] not in VALID_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Недопустимый статус",
            )
        row.status = data["status"]
    if "notes" in data:
        notes = data["notes"]
        row.notes = (notes or "").strip() or None
    db.commit()
    db.refresh(row)
    return InspectionBookingView.model_validate(row)
