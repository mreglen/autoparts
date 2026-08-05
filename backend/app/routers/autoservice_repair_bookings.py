from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.repair_booking import RepairBooking
from app.models.user import User
from app.schemas.repair_booking import (
    REPAIR_BOOKING_STATUSES,
    RepairBookingCreate,
    RepairBookingPatch,
    RepairBookingView,
)
from app.utils.autoservice_access import (
    normalize_phone_or_400,
    require_autoservice_staff,
    require_my_active_autoservice_client,
)

router = APIRouter(tags=["Autoservice repair bookings"])


@router.post(
    "/autoservice/repair-bookings",
    response_model=RepairBookingView,
    status_code=status.HTTP_201_CREATED,
)
def create_repair_booking(
    payload: RepairBookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = require_my_active_autoservice_client(db, current_user)

    name = (payload.name or "").strip() or client.name
    raw_phone = (payload.phone or "").strip() or client.phone
    phone = normalize_phone_or_400(raw_phone)

    row = RepairBooking(
        organization_id=client.organization_id,
        client_id=client.id,
        name=name[:120],
        phone=phone,
        preferred_date=payload.preferred_date,
        comment=(payload.comment or "").strip() or None,
        status="new",
        source="client",
        created_by_user_id=current_user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return RepairBookingView.model_validate(row)


@router.get(
    "/autoservice/repair-bookings/me",
    response_model=list[RepairBookingView],
)
def list_my_repair_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = require_my_active_autoservice_client(db, current_user)
    rows = (
        db.query(RepairBooking)
        .filter(RepairBooking.client_id == client.id)
        .order_by(RepairBooking.preferred_date.desc(), RepairBooking.id.desc())
        .all()
    )
    return [RepairBookingView.model_validate(row) for row in rows]


@router.get(
    "/autoservice/repair-bookings",
    response_model=list[RepairBookingView],
)
def list_repair_bookings(
    status_filter: str | None = Query(None, alias="status"),
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    query = db.query(RepairBooking).filter(RepairBooking.organization_id == org_id)
    if status_filter:
        if status_filter not in REPAIR_BOOKING_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Недопустимый статус",
            )
        query = query.filter(RepairBooking.status == status_filter)
    if date_from:
        query = query.filter(RepairBooking.preferred_date >= date_from)
    if date_to:
        query = query.filter(RepairBooking.preferred_date <= date_to)
    rows = (
        query.order_by(RepairBooking.preferred_date.asc(), RepairBooking.id.asc()).all()
    )
    return [RepairBookingView.model_validate(row) for row in rows]


@router.patch(
    "/autoservice/repair-bookings/{booking_id}",
    response_model=RepairBookingView,
)
def patch_repair_booking(
    booking_id: int,
    payload: RepairBookingPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нет полей для обновления",
        )
    row = (
        db.query(RepairBooking)
        .filter(
            RepairBooking.id == booking_id,
            RepairBooking.organization_id == org_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заявка не найдена",
        )
    if data.get("status"):
        row.status = data["status"]
    if "staff_notes" in data:
        row.staff_notes = (data["staff_notes"] or "").strip() or None
    db.commit()
    db.refresh(row)
    return RepairBookingView.model_validate(row)
