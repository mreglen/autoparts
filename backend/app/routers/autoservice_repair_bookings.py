from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_client import AutoserviceClient
from app.models.garage_vehicle import GarageVehicle
from app.models.inspection_booking import InspectionBooking
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
    AUTOSERVICE_PERMISSION_INSPECTIONS,
    normalize_phone_or_400,
    related_autoservice_client_ids,
    require_autoservice_permission,
    require_my_active_autoservice_client,
)

router = APIRouter(tags=["Autoservice repair bookings (legacy compat)"])


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


def _inspection_to_repair_view(row: InspectionBooking) -> RepairBookingView:
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
        comment=row.notes,
        status=row.status,
        source=row.source,
        staff_notes=None,
        created_at=row.created_at,
    )


def _find_staff_inspection_booking(
    db: Session,
    *,
    org_id: str,
    booking_id: int,
) -> InspectionBooking | None:
    return (
        db.query(InspectionBooking)
        .options(joinedload(InspectionBooking.vehicle))
        .filter(
            InspectionBooking.organization_id == org_id,
            or_(
                InspectionBooking.id == booking_id,
                InspectionBooking.legacy_repair_booking_id == booking_id,
            ),
        )
        .first()
    )


@router.post(
    "/autoservice/repair-bookings",
    response_model=RepairBookingView,
    status_code=status.HTTP_201_CREATED,
    deprecated=True,
)
def create_repair_booking(
    payload: RepairBookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Legacy alias — creates a unified inspection booking."""
    client = require_my_active_autoservice_client(db, current_user)

    name = (payload.name or "").strip() or client.name
    raw_phone = (payload.phone or "").strip() or client.phone
    phone = normalize_phone_or_400(raw_phone)
    vehicle = _resolve_garage_vehicle(
        db,
        client=client,
        garage_vehicle_id=payload.garage_vehicle_id,
    )

    row = InspectionBooking(
        organization_id=client.organization_id,
        client_id=client.id,
        garage_vehicle_id=vehicle.id if vehicle else None,
        name=name[:120],
        phone=phone,
        preferred_date=payload.preferred_date,
        status="new",
        source="client",
        created_by_user_id=current_user.id,
        notes=(payload.comment or "").strip() or None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    if vehicle:
        row.vehicle = vehicle
    return _inspection_to_repair_view(row)


@router.post(
    "/autoservice/repair-bookings/staff",
    response_model=RepairBookingView,
    status_code=status.HTTP_201_CREATED,
    deprecated=True,
)
def create_repair_booking_staff(
    payload: RepairBookingStaffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Legacy alias — creates a unified inspection booking."""
    org_id = require_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_INSPECTIONS)
    name = payload.name.strip()
    phone = normalize_phone_or_400(payload.phone)
    garage_vehicle_id = payload.garage_vehicle_id
    client_id = None
    vehicle = None
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
        client_id = vehicle.client_id

    row = InspectionBooking(
        organization_id=org_id,
        client_id=client_id,
        garage_vehicle_id=vehicle.id if vehicle else None,
        name=name[:120],
        phone=phone,
        preferred_date=payload.preferred_date,
        status="new",
        source="staff",
        created_by_user_id=current_user.id,
        notes=(payload.comment or "").strip() or None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    if vehicle:
        row.vehicle = vehicle
    return _inspection_to_repair_view(row)


@router.get(
    "/autoservice/repair-bookings/me",
    response_model=list[RepairBookingView],
    deprecated=True,
)
def list_my_repair_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Legacy alias — lists unified inspection bookings for the current client."""
    client = require_my_active_autoservice_client(db, current_user)
    related_ids = related_autoservice_client_ids(db, client)
    rows = (
        db.query(InspectionBooking)
        .options(joinedload(InspectionBooking.vehicle))
        .filter(
            InspectionBooking.organization_id == client.organization_id,
            or_(
                InspectionBooking.client_id.in_(related_ids),
                InspectionBooking.created_by_user_id == current_user.id,
            ),
        )
        .order_by(InspectionBooking.preferred_date.desc(), InspectionBooking.id.desc())
        .all()
    )
    return [_inspection_to_repair_view(row) for row in rows]


@router.get(
    "/autoservice/repair-bookings",
    response_model=list[RepairBookingView],
    deprecated=True,
)
def list_repair_bookings(
    status_filter: str | None = Query(None, alias="status"),
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Legacy alias — lists unified inspection bookings for staff."""
    org_id = require_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_INSPECTIONS)
    query = (
        db.query(InspectionBooking)
        .options(joinedload(InspectionBooking.vehicle))
        .filter(InspectionBooking.organization_id == org_id)
    )
    if status_filter:
        if status_filter not in REPAIR_BOOKING_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Недопустимый статус",
            )
        query = query.filter(InspectionBooking.status == status_filter)
    if date_from:
        query = query.filter(InspectionBooking.preferred_date >= date_from)
    if date_to:
        query = query.filter(InspectionBooking.preferred_date <= date_to)
    rows = (
        query.order_by(InspectionBooking.preferred_date.asc(), InspectionBooking.id.asc()).all()
    )
    return [_inspection_to_repair_view(row) for row in rows]


@router.patch(
    "/autoservice/repair-bookings/{booking_id}",
    response_model=RepairBookingView,
    deprecated=True,
)
def patch_repair_booking(
    booking_id: int,
    payload: RepairBookingPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Legacy alias — updates a unified inspection booking."""
    org_id = require_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_INSPECTIONS)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нет полей для обновления",
        )
    row = _find_staff_inspection_booking(db, org_id=org_id, booking_id=booking_id)
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
        row.notes = (data["comment"] or "").strip() or None
    if data.get("status"):
        row.status = data["status"]
    if "staff_notes" in data:
        staff_notes = (data["staff_notes"] or "").strip() or None
        if staff_notes:
            base = (row.notes or "").strip()
            row.notes = f"{base}\n\n{staff_notes}".strip() if base else staff_notes
    db.commit()
    db.refresh(row)
    return _inspection_to_repair_view(row)
