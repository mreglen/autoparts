from __future__ import annotations

from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_work_zone import AutoserviceWorkZone
from app.models.inspection_booking import InspectionBooking
from app.models.repair_order import RepairOrder
from app.models.user import User
from app.schemas.autoservice_planner import (
    PlannerRepairOrder,
    PlannerWeekDayHeader,
    PlannerWeekResponse,
    PlannerWeekZoneDay,
    PlannerWeekZoneRow,
)
from app.services.autoservice_planner_items import (
    planner_inspection_item as _planner_inspection,
    planner_order_item as _planner_order,
)
from app.utils.autoservice_access import (
    AUTOSERVICE_PERMISSION_PLANNER,
    require_autoservice_permission,
)
router = APIRouter(tags=["Autoservice planner"])

UNASSIGNED_ZONE_NAME = "Без рабочей зоны"
UNASSIGNED_SORT_ORDER = 1_000_000


def _week_start(value: date) -> date:
    return value - timedelta(days=value.weekday())


def _place_item(
    item: PlannerRepairOrder,
    day_key: date,
    *,
    zone_day_map: dict[int | None, dict[date, list[PlannerRepairOrder]]],
    unassigned_days: dict[date, list[PlannerRepairOrder]],
    active_zone_ids: set[int],
) -> None:
    if day_key not in unassigned_days:
        return
    if item.work_zone_id and item.work_zone_id in active_zone_ids:
        zone_day_map[item.work_zone_id][day_key].append(item)
    else:
        unassigned_days[day_key].append(item)


@router.get(
    "/autoservice/planner/conflicts",
    response_model=list[PlannerRepairOrder],
)
def get_planner_conflicts(
    work_zone_id: int = Query(..., ge=1),
    start: datetime = Query(...),
    end: datetime | None = Query(None),
    exclude_order_id: int | None = Query(None, ge=1),
    exclude_booking_id: int | None = Query(None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Пересекающиеся записи в рабочей зоне — для предупреждения при сохранении."""
    org_id = require_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_PLANNER)
    eff_start = start.replace(tzinfo=None)
    eff_end = (end or start).replace(tzinfo=None)
    if eff_end <= eff_start:
        eff_end = eff_start + timedelta(hours=1)

    orders_query = (
        db.query(RepairOrder)
        .options(
            joinedload(RepairOrder.client),
            joinedload(RepairOrder.vehicle),
            joinedload(RepairOrder.work_zone),
        )
        .filter(
            RepairOrder.organization_id == org_id,
            RepairOrder.work_zone_id == work_zone_id,
            RepairOrder.scheduled_at < eff_end,
            or_(
                RepairOrder.scheduled_end_at > eff_start,
                and_(
                    RepairOrder.scheduled_end_at.is_(None),
                    RepairOrder.scheduled_at >= eff_start,
                ),
            ),
            RepairOrder.status.notin_(("cancelled", "review")),
        )
    )
    if exclude_order_id:
        orders_query = orders_query.filter(RepairOrder.id != exclude_order_id)
    orders = orders_query.order_by(RepairOrder.scheduled_at.asc()).all()

    bookings_query = (
        db.query(InspectionBooking)
        .options(
            joinedload(InspectionBooking.vehicle),
            joinedload(InspectionBooking.work_zone),
        )
        .filter(
            InspectionBooking.organization_id == org_id,
            InspectionBooking.work_zone_id == work_zone_id,
            InspectionBooking.preferred_date == eff_start.date(),
            InspectionBooking.status.in_(("new", "confirmed")),
        )
    )
    if exclude_booking_id:
        bookings_query = bookings_query.filter(InspectionBooking.id != exclude_booking_id)
    bookings = bookings_query.order_by(InspectionBooking.preferred_time.asc()).all()

    items = [_planner_order(row) for row in orders]
    items.extend(_planner_inspection(row) for row in bookings)
    items.sort(key=lambda item: item.scheduled_at)
    return items


@router.get("/autoservice/planner/week", response_model=PlannerWeekResponse)
def get_planner_week(
    week_start: date = Query(..., alias="week_start"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_PLANNER)
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
            RepairOrder.scheduled_at < range_end,
            (
                (RepairOrder.scheduled_end_at > range_start)
                | (RepairOrder.status == "in_progress")
                | (
                    RepairOrder.scheduled_end_at.is_(None)
                    & (RepairOrder.scheduled_at >= range_start)
                )
            ),
            RepairOrder.status.notin_(("cancelled", "review")),
        )
        .order_by(RepairOrder.scheduled_at.asc(), RepairOrder.id.asc())
        .all()
    )

    inspections = (
        db.query(InspectionBooking)
        .options(
            joinedload(InspectionBooking.vehicle),
            joinedload(InspectionBooking.work_zone),
        )
        .filter(
            InspectionBooking.organization_id == org_id,
            InspectionBooking.preferred_date >= day_dates[0],
            InspectionBooking.preferred_date <= week_end,
            InspectionBooking.status == "confirmed",
        )
        .order_by(InspectionBooking.preferred_date.asc(), InspectionBooking.id.asc())
        .all()
    )

    zone_day_map: dict[int | None, dict[date, list[PlannerRepairOrder]]] = {
        zone.id: {day: [] for day in day_dates} for zone in zones
    }
    unassigned_days = {day: [] for day in day_dates}

    active_zone_ids = {zone.id for zone in zones}
    for row in orders:
        item_day = row.scheduled_at.date()
        _place_item(
            _planner_order(row),
            item_day if item_day >= day_dates[0] else day_dates[0],
            zone_day_map=zone_day_map,
            unassigned_days=unassigned_days,
            active_zone_ids=active_zone_ids,
        )
    for row in inspections:
        _place_item(
            _planner_inspection(row),
            row.preferred_date,
            zone_day_map=zone_day_map,
            unassigned_days=unassigned_days,
            active_zone_ids=active_zone_ids,
        )

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
