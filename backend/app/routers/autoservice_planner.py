from __future__ import annotations

from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_lift import AutoserviceLift
from app.models.garage_vehicle import GarageVehicle
from app.models.inspection_booking import InspectionBooking
from app.models.repair_booking import RepairBooking
from app.models.repair_order import RepairOrder
from app.models.user import User
from app.schemas.autoservice_planner import (
    PlannerDay,
    PlannerInspectionBooking,
    PlannerLiftColumn,
    PlannerLiftsDayResponse,
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


def _planner_order(row: RepairOrder) -> PlannerRepairOrder:
    return PlannerRepairOrder(
        id=row.id,
        order_number=row.order_number,
        client_id=row.client_id,
        client_name=row.client.name if row.client else "—",
        client_phone=row.client.phone if row.client else "",
        vehicle=_vehicle_label(row.vehicle),
        status=row.status,
        scheduled_at=row.scheduled_at,
        scheduled_end_at=row.scheduled_end_at,
        lift_id=row.lift_id,
        lift_name=row.lift.name if row.lift else None,
    )


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
            joinedload(RepairOrder.lift),
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

    inspection_bookings = (
        db.query(InspectionBooking)
        .filter(
            InspectionBooking.organization_id == org_id,
            InspectionBooking.preferred_date >= date_from,
            InspectionBooking.preferred_date <= date_to,
            InspectionBooking.status != "cancelled",
        )
        .order_by(InspectionBooking.preferred_date.asc(), InspectionBooking.id.asc())
        .all()
    )

    days: dict[date, PlannerDay] = {}
    cursor = date_from
    while cursor <= date_to:
        days[cursor] = PlannerDay(
            date=cursor,
            repair_orders=[],
            repair_bookings=[],
            inspection_bookings=[],
        )
        cursor += timedelta(days=1)

    for row in orders:
        day = days.get(row.scheduled_at.date())
        if day is None:
            continue
        day.repair_orders.append(_planner_order(row))

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

    for row in inspection_bookings:
        day = days.get(row.preferred_date)
        if day is None:
            continue
        day.inspection_bookings.append(
            PlannerInspectionBooking(
                id=row.id,
                name=row.name,
                phone=row.phone,
                preferred_date=row.preferred_date,
                notes=row.notes,
                status=row.status,
                source=row.source,
            )
        )

    return PlannerResponse(
        date_from=date_from,
        date_to=date_to,
        days=[days[key] for key in sorted(days)],
    )


@router.get("/autoservice/planner/lifts", response_model=PlannerLiftsDayResponse)
def get_planner_lifts_day(
    day: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    range_start = datetime.combine(day, time.min)
    range_end = datetime.combine(day + timedelta(days=1), time.min)

    lifts = (
        db.query(AutoserviceLift)
        .filter(
            AutoserviceLift.organization_id == org_id,
            AutoserviceLift.is_active.is_(True),
        )
        .order_by(AutoserviceLift.sort_order.asc(), AutoserviceLift.id.asc())
        .all()
    )

    orders = (
        db.query(RepairOrder)
        .options(
            joinedload(RepairOrder.client),
            joinedload(RepairOrder.vehicle),
            joinedload(RepairOrder.lift),
        )
        .filter(
            RepairOrder.organization_id == org_id,
            RepairOrder.scheduled_at >= range_start,
            RepairOrder.scheduled_at < range_end,
            RepairOrder.status != "cancelled",
        )
        .order_by(RepairOrder.scheduled_at.asc(), RepairOrder.id.asc())
        .all()
    )

    by_lift: dict[int, list[PlannerRepairOrder]] = {lift.id: [] for lift in lifts}
    unassigned: list[PlannerRepairOrder] = []

    for row in orders:
        item = _planner_order(row)
        if row.lift_id and row.lift_id in by_lift:
            by_lift[row.lift_id].append(item)
        else:
            unassigned.append(item)

    columns = [
        PlannerLiftColumn(
            id=lift.id,
            name=lift.name,
            sort_order=lift.sort_order,
            orders=by_lift.get(lift.id, []),
        )
        for lift in lifts
    ]

    return PlannerLiftsDayResponse(
        date=day,
        lifts=columns,
        unassigned_orders=unassigned,
    )
