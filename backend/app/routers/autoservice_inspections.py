from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.auth import get_current_user, get_current_user_optional
from app.db.database import get_db
from app.models.autoservice_client import AutoserviceClient
from app.models.garage_vehicle import GarageVehicle
from app.models.inspection_booking import InspectionBooking
from app.models.user import User
from app.schemas.inspection_booking import (
    InspectionBookingClientCreate,
    InspectionBookingPatch,
    InspectionBookingPublicCreate,
    InspectionBookingStaffCreate,
    InspectionBookingVehicleBrief,
    InspectionBookingView,
)
from app.utils.autoservice_access import (
    normalize_phone_or_400,
    related_autoservice_client_ids,
    require_autoservice_staff,
    require_my_active_autoservice_client,
)
from app.utils.org_access import resolve_autoservice_organization_id
from app.utils.phone import normalize_to_storage_format
from app.utils.site_settings_db import autoservice_enabled
from app.services.autoservice_notifications import notify_new_inspection_booking

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


def _normalize_phone_or_400(phone: str) -> str:
    normalized = normalize_to_storage_format(phone)
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный формат телефона",
        )
    return normalized


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


def _booking_to_view(row: InspectionBooking) -> InspectionBookingView:
    vehicle_brief = None
    if row.vehicle is not None:
        vehicle_brief = InspectionBookingVehicleBrief.model_validate(row.vehicle)
    return InspectionBookingView(
        id=row.id,
        organization_id=row.organization_id,
        client_id=row.client_id,
        garage_vehicle_id=row.garage_vehicle_id,
        vehicle=vehicle_brief,
        name=row.name,
        phone=row.phone,
        preferred_date=row.preferred_date,
        status=row.status,
        source=row.source,
        created_by_user_id=row.created_by_user_id,
        notes=row.notes,
        created_at=row.created_at,
    )


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
    notify_new_inspection_booking(db, row)
    return _booking_to_view(row)


@router.get(
    "/autoservice/inspection-bookings/me",
    response_model=list[InspectionBookingView],
)
def list_my_inspection_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
    return [_booking_to_view(row) for row in rows]


@router.post(
    "/autoservice/inspection-bookings/me",
    response_model=InspectionBookingView,
    status_code=status.HTTP_201_CREATED,
)
def create_client_inspection_booking(
    payload: InspectionBookingClientCreate,
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
        notes=(payload.notes or "").strip() or None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    if vehicle:
        row.vehicle = vehicle
    notify_new_inspection_booking(db, row)
    return _booking_to_view(row)


@router.get(
    "/autoservice/inspection-bookings",
    response_model=list[InspectionBookingView],
)
def list_inspection_bookings(
    status_filter: str | None = Query(None, alias="status"),
    client_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    q = (
        db.query(InspectionBooking)
        .options(joinedload(InspectionBooking.vehicle))
        .filter(InspectionBooking.organization_id == org_id)
    )
    if client_id is not None:
        client = (
            db.query(AutoserviceClient)
            .filter(
                AutoserviceClient.id == client_id,
                AutoserviceClient.organization_id == org_id,
            )
            .first()
        )
        if not client:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Клиент не найден")
        related_ids = related_autoservice_client_ids(db, client)
        phone_clauses = [InspectionBooking.client_id.in_(related_ids)]
        phone = (client.phone or "").strip()
        if phone:
            phone_clauses.append(InspectionBooking.phone == phone)
        q = q.filter(or_(*phone_clauses))
    if status_filter:
        if status_filter not in VALID_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Недопустимый статус",
            )
        q = q.filter(InspectionBooking.status == status_filter)
    rows = q.order_by(InspectionBooking.created_at.desc(), InspectionBooking.id.desc()).all()
    return [_booking_to_view(row) for row in rows]


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
    org_id = require_autoservice_staff(db, current_user)
    phone = _normalize_phone_or_400(payload.phone)
    notes = (payload.notes or "").strip() or None
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
    if vehicle:
        row.vehicle = vehicle
    return _booking_to_view(row)


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
    org_id = require_autoservice_staff(db, current_user)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нет полей для обновления",
        )
    row = (
        db.query(InspectionBooking)
        .options(joinedload(InspectionBooking.vehicle))
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
    return _booking_to_view(row)
