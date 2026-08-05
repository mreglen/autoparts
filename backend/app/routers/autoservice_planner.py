from __future__ import annotations

from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.garage_vehicle import GarageVehicle
from app.models.repair_booking import RepairBooking
from app.models.repair_order import RepairOrder
from app.models.user import User
from app.schemas.autoservice_planner import (
    PlannerDay,
    PlannerRepairBooking,
    PlannerRepairOrder,
    PlannerResponse,
)
from app.utils.autoservice_access import require_autoservice_staff

router = APIRouter(tags=["Autoservice planner"])

MAX_PLANNER_RANGE_DAYS = 62


def _vehicle_label(vehicle: GarageVehicle | None) -> str:
    if not vehicle:
        return "—"
    parts = [vehicle.make, vehicle.model]
    label = " ".join(p for p in parts if p).strip()
    if vehicle.plate:
        label = f"{label} ({vehicle.plate})" if label else vehicle.plate
    return label or "—"


@router.get("/autoservice/planner", response_model=PlannerResponse)
def get_planner(
    date_from: date = Query(..., alias="from"),
    date_to: date = Query(..., alias="to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    if date_to < date_from:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Дата окончания раньше даты начала",
        )
    if (date_to - date_from).days > MAX_PLANNER_RANGE_DAYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Максимальный диапазон — {MAX_PLANNER_RANGE_DAYS} дней",
        )

    range_start = datetime.combine(date_from, time.min)
    range_end = datetime.combine(date_to + timedelta(days=1), time.min)

    orders = (
        db.query(RepairOrder)
        .options(
            joinedload(RepairOrder.client),
            joinedload(RepairOrder.vehicle),
        )
        .filter(
            RepairOrder.organization_id == org_id,
            RepairOrder.scheduled_at >= range_start,
            RepairOrder.scheduled_at < range_end,
        )
        .order_by(RepairOrder.scheduled_at.asc(), RepairOrder.id.asc())
        .all()
    )

    bookings = (
        db.query(RepairBooking)
        .filter(
            RepairBooking.organization_id == org_id,
            RepairBooking.preferred_date >= date_from,
            RepairBooking.preferred_date <= date_to,
            RepairBooking.status != "cancelled",
        )
        .order_by(RepairBooking.preferred_date.asc(), RepairBooking.id.asc())
        .all()
    )

    days: dict[date, PlannerDay] = {}
    cursor = date_from
    while cursor <= date_to:
        days[cursor] = PlannerDay(date=cursor, repair_orders=[], repair_bookings=[])
        cursor += timedelta(days=1)

    for row in orders:
        day = days.get(row.scheduled_at.date())
        if day is None:
            continue
        day.repair_orders.append(
            PlannerRepairOrder(
                id=row.id,
                order_number=row.order_number,
                client_id=row.client_id,
                client_name=row.client.name if row.client else "—",
                client_phone=row.client.phone if row.client else "",
                vehicle=_vehicle_label(row.vehicle),
                status=row.status,
                scheduled_at=row.scheduled_at,
                lift_number=row.lift_number,
            )
        )

    for row in bookings:
        day = days.get(row.preferred_date)
        if day is None:
            continue
        day.repair_bookings.append(
            PlannerRepairBooking(
                id=row.id,
                client_id=row.client_id,
                name=row.name,
                phone=row.phone,
                preferred_date=row.preferred_date,
                comment=row.comment,
                status=row.status,
            )
        )

    return PlannerResponse(
        date_from=date_from,
        date_to=date_to,
        days=[days[key] for key in sorted(days)],
    )
