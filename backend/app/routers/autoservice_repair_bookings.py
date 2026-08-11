from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_client import AutoserviceClient
from app.models.garage_vehicle import GarageVehicle
from app.models.repair_booking import RepairBooking
from app.models.user import User
from app.schemas.repair_booking import (
    REPAIR_BOOKING_STATUSES,
    RepairBookingCreate,
    RepairBookingPatch,
    RepairBookingStaffCreate,
    RepairBookingVehicleBrief,
    RepairBookingView,
)
from app.utils.autoservice_access import (
    normalize_phone_or_400,
    related_autoservice_client_ids,
    require_autoservice_staff,
    require_my_active_autoservice_client,
)

router = APIRouter(tags=["Autoservice repair bookings"])


def _resolve_garage_vehicle(
    db: Session,
    *,
    client: AutoserviceClient,
    garage_vehicle_id: int | None,
) -> GarageVehicle | None:
    if garage_vehicle_id is None:
        return None
    related_ids = related_autoservice_client_ids(db, client)
    vehicle = (
        db.query(GarageVehicle)
        .filter(
            GarageVehicle.id == garage_vehicle_id,
            GarageVehicle.client_id.in_(related_ids),
            GarageVehicle.organization_id == client.organization_id,
        )
        .first()
    )
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Автомобиль не найден",
        )
    return vehicle


def _booking_to_view(row: RepairBooking) -> RepairBookingView:
    vehicle_brief = None
    if row.vehicle is not None:
        vehicle_brief = RepairBookingVehicleBrief.model_validate(row.vehicle)
    return RepairBookingView(
        id=row.id,
        organization_id=row.organization_id,
        client_id=row.client_id,
        garage_vehicle_id=row.garage_vehicle_id,
        vehicle=vehicle_brief,
        name=row.name,
        phone=row.phone,
        preferred_date=row.preferred_date,
        comment=row.comment,
        status=row.status,
        source=row.source,
        staff_notes=row.staff_notes,
        created_at=row.created_at,
    )


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
    vehicle = _resolve_garage_vehicle(
        db,
        client=client,
        garage_vehicle_id=payload.garage_vehicle_id,
    )

    row = RepairBooking(
        organization_id=client.organization_id,
        client_id=client.id,
        garage_vehicle_id=vehicle.id if vehicle else None,
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
    if vehicle:
        row.vehicle = vehicle
    return _booking_to_view(row)


@router.post(
    "/autoservice/repair-bookings/staff",
    response_model=RepairBookingView,
    status_code=status.HTTP_201_CREATED,
)
def create_repair_booking_staff(
    payload: RepairBookingStaffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    name = payload.name.strip()
    phone = normalize_phone_or_400(payload.phone)
    garage_vehicle_id = payload.garage_vehicle_id
    if garage_vehicle_id is not None:
        vehicle = (
            db.query(GarageVehicle)
            .filter(
                GarageVehicle.id == garage_vehicle_id,
                GarageVehicle.organization_id == org_id,
            )
            .first()
        )
        if not vehicle:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Автомобиль не найден",
            )
    else:
        vehicle = None

    row = RepairBooking(
        organization_id=org_id,
        client_id=vehicle.client_id if vehicle else None,
        garage_vehicle_id=vehicle.id if vehicle else None,
        name=name[:120],
        phone=phone,
        preferred_date=payload.preferred_date,
        comment=(payload.comment or "").strip() or None,
        status="new",
        source="staff",
        created_by_user_id=current_user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    if vehicle:
        row.vehicle = vehicle
    return _booking_to_view(row)


@router.get(
    "/autoservice/repair-bookings/me",
    response_model=list[RepairBookingView],
)
def list_my_repair_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = require_my_active_autoservice_client(db, current_user)
    related_ids = related_autoservice_client_ids(db, client)
    rows = (
        db.query(RepairBooking)
        .options(joinedload(RepairBooking.vehicle))
        .filter(
            RepairBooking.organization_id == client.organization_id,
            or_(
                RepairBooking.client_id.in_(related_ids),
                RepairBooking.created_by_user_id == current_user.id,
            ),
        )
        .order_by(RepairBooking.preferred_date.desc(), RepairBooking.id.desc())
        .all()
    )
    return [_booking_to_view(row) for row in rows]


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
    query = (
        db.query(RepairBooking)
        .options(joinedload(RepairBooking.vehicle))
        .filter(RepairBooking.organization_id == org_id)
    )
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
    return [_booking_to_view(row) for row in rows]


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
        .options(joinedload(RepairBooking.vehicle))
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
    if "name" in data:
        name = (data["name"] or "").strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Имя не может быть пустым",
            )
        row.name = name[:120]
    if "phone" in data:
        row.phone = normalize_phone_or_400(data["phone"] or "")
    if "preferred_date" in data and data["preferred_date"]:
        row.preferred_date = data["preferred_date"]
    if "comment" in data:
        row.comment = (data["comment"] or "").strip() or None
    if data.get("status"):
        row.status = data["status"]
    if "staff_notes" in data:
        row.staff_notes = (data["staff_notes"] or "").strip() or None
    db.commit()
    db.refresh(row)
    return _booking_to_view(row)
