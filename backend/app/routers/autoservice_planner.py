from __future__ import annotations

from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_work_zone import AutoserviceWorkZone
from app.models.garage_vehicle import GarageVehicle
from app.models.repair_order import RepairOrder
from app.models.user import User
from app.schemas.autoservice_planner import (
    PlannerRepairOrder,
    PlannerWeekDayHeader,
    PlannerWeekResponse,
    PlannerWeekZoneDay,
    PlannerWeekZoneRow,
)
from app.utils.autoservice_access import display_client_phone, require_autoservice_staff

router = APIRouter(tags=["Autoservice planner"])

UNASSIGNED_ZONE_NAME = "Без рабочей зоны"
UNASSIGNED_SORT_ORDER = 1_000_000


def _vehicle_label(vehicle: GarageVehicle | None) -> str:
    if not vehicle:
        return "—"
    parts = [vehicle.make, vehicle.model]
    label = " ".join(p for p in parts if p).strip()
    if vehicle.plate:
        label = f"{label} ({vehicle.plate})" if label else vehicle.plate
    return label or "—"


def _week_start(value: date) -> date:
    return value - timedelta(days=value.weekday())


def _planner_order(row: RepairOrder) -> PlannerRepairOrder:
    return PlannerRepairOrder(
        id=row.id,
        order_number=row.order_number,
        client_id=row.client_id,
        client_name=row.client.name if row.client else "—",
        client_phone=display_client_phone(row.client.phone) if row.client else "",
        vehicle=_vehicle_label(row.vehicle),
        status=row.status,
        scheduled_at=row.scheduled_at,
        scheduled_end_at=row.scheduled_end_at,
        work_zone_id=row.work_zone_id,
        work_zone_name=row.work_zone.name if row.work_zone else None,
    )


@router.get("/autoservice/planner/week", response_model=PlannerWeekResponse)
def get_planner_week(
    week_start: date = Query(..., alias="week_start"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    start = _week_start(week_start)
    day_dates = [start + timedelta(days=offset) for offset in range(7)]
    week_end = day_dates[-1]

    range_start = datetime.combine(day_dates[0], time.min)
    range_end = datetime.combine(day_dates[-1] + timedelta(days=1), time.min)

    zones = (
        db.query(AutoserviceWorkZone)
        .filter(
            AutoserviceWorkZone.organization_id == org_id,
            AutoserviceWorkZone.is_active.is_(True),
        )
        .order_by(AutoserviceWorkZone.sort_order.asc(), AutoserviceWorkZone.id.asc())
        .all()
    )

    orders = (
        db.query(RepairOrder)
        .options(
            joinedload(RepairOrder.client),
            joinedload(RepairOrder.vehicle),
            joinedload(RepairOrder.work_zone),
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

    zone_day_map: dict[int | None, dict[date, list[PlannerRepairOrder]]] = {
        zone.id: {day: [] for day in day_dates} for zone in zones
    }
    unassigned_days = {day: [] for day in day_dates}

    active_zone_ids = {zone.id for zone in zones}
    for row in orders:
        item = _planner_order(row)
        day_key = row.scheduled_at.date()
        if day_key not in unassigned_days:
            continue
        if row.work_zone_id and row.work_zone_id in active_zone_ids:
            zone_day_map[row.work_zone_id][day_key].append(item)
        else:
            unassigned_days[day_key].append(item)

    zone_rows: list[PlannerWeekZoneRow] = [
        PlannerWeekZoneRow(
            id=zone.id,
            name=zone.name,
            sort_order=zone.sort_order,
            days=[
                PlannerWeekZoneDay(date=day, orders=zone_day_map[zone.id][day])
                for day in day_dates
            ],
        )
        for zone in zones
    ]

    zone_rows.append(
        PlannerWeekZoneRow(
            id=None,
            name=UNASSIGNED_ZONE_NAME,
            sort_order=UNASSIGNED_SORT_ORDER,
            is_unassigned=True,
            days=[
                PlannerWeekZoneDay(date=day, orders=unassigned_days[day])
                for day in day_dates
            ],
        )
    )

    return PlannerWeekResponse(
        week_start=day_dates[0],
        week_end=week_end,
        days=[PlannerWeekDayHeader(date=day) for day in day_dates],
        zones=zone_rows,
    )
