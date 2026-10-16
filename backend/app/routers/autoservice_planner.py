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
    PlannerEmployeeWorkZoneView,
    PlannerEmployeeWorkZonesResponse,
    PlannerMonthDay,
    PlannerMonthResponse,
    PlannerRepairOrder,
    PlannerWeekDayHeader,
    PlannerWeekResponse,
    PlannerWeekZoneDay,
    PlannerWeekZoneRow,
    PlannerZoneRef,
)
from app.services.autoservice_planner_items import (
    planner_inspection_item as _planner_inspection,
    planner_order_item as _planner_order,
)
from app.utils.autoservice_access import (
    AUTOSERVICE_PERMISSION_PLANNER,
    UNASSIGNED_ZONE_NAME,
    planner_zone_rights,
    require_autoservice_permission,
)
router = APIRouter(tags=["Autoservice planner"])

UNASSIGNED_SORT_ORDER = 1_000_000


def _week_start(value: date) -> date:
    return value - timedelta(days=value.weekday())


def _month_last_day(value: date) -> date:
    return (value.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)


def _place_item(
    item: PlannerRepairOrder,
    day_key: date,
    *,
    zone_day_map: dict[int | None, dict[date, list[PlannerRepairOrder]]],
    unassigned_days: dict[date, list[PlannerRepairOrder]],
    active_zone_ids: set[int],
    known_zone_ids: set[int],
) -> None:
    if day_key not in unassigned_days:
        return
    zone_id = item.work_zone_id
    if zone_id in active_zone_ids:
        zone_day_map[zone_id][day_key].append(item)
        return
    if zone_id and zone_id in known_zone_ids:
        return
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


@router.get(
    "/autoservice/planner/employee-work-zones",
    response_model=PlannerEmployeeWorkZonesResponse,
)
def get_planner_employee_work_zones(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Зоны планировщика с правами текущего пользователя."""
    org_id = require_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_PLANNER)
    full_access, rights = planner_zone_rights(db, current_user, org_id)
    zones = (
        db.query(AutoserviceWorkZone)
        .filter(
            AutoserviceWorkZone.organization_id == org_id,
            AutoserviceWorkZone.is_active.is_(True),
        )
        .order_by(AutoserviceWorkZone.sort_order.asc(), AutoserviceWorkZone.id.asc())
        .all()
    )
    items = [
        PlannerEmployeeWorkZoneView(
            work_zone_id=zone.id,
            work_zone_name=zone.name,
            can_view=entry["can_view"],
            can_edit=entry["can_edit"],
            can_caldav=entry["can_caldav"],
        )
        for zone in zones
        if (entry := rights.get(zone.id)) and entry["can_view"]
    ]
    unassigned = rights.get(None)
    if unassigned and unassigned["can_view"]:
        items.append(
            PlannerEmployeeWorkZoneView(
                work_zone_id=None,
                work_zone_name=UNASSIGNED_ZONE_NAME,
                can_view=True,
                can_edit=unassigned["can_edit"],
                can_caldav=unassigned["can_caldav"],
            )
        )
    return PlannerEmployeeWorkZonesResponse(full_access=full_access, zones=items)


def _planner_zone_rows(
    db: Session,
    org_id: str,
    day_dates: list[date],
    full_access: bool,
    zone_rights: dict[int | None, dict[str, bool]],
) -> list[PlannerWeekZoneRow]:
    start_day = day_dates[0]
    end_day = day_dates[-1]

    range_start = datetime.combine(start_day, time.min)
    range_end = datetime.combine(end_day + timedelta(days=1), time.min)

    zones = [
        zone
        for zone in (
            db.query(AutoserviceWorkZone)
            .filter(
                AutoserviceWorkZone.organization_id == org_id,
                AutoserviceWorkZone.is_active.is_(True),
            )
            .order_by(AutoserviceWorkZone.sort_order.asc(), AutoserviceWorkZone.id.asc())
            .all()
        )
        if zone_rights.get(zone.id, {}).get("can_view")
    ]

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
                | RepairOrder.status.in_(("in_progress", "pending"))
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
            InspectionBooking.preferred_date >= start_day,
            InspectionBooking.preferred_date <= end_day,
            InspectionBooking.status.in_(("confirmed", "processed")),
        )
        .order_by(InspectionBooking.preferred_date.asc(), InspectionBooking.id.asc())
        .all()
    )

    zone_day_map: dict[int | None, dict[date, list[PlannerRepairOrder]]] = {
        zone.id: {day: [] for day in day_dates} for zone in zones
    }
    unassigned_days = {day: [] for day in day_dates}

    active_zone_ids = {zone.id for zone in zones}
    known_zone_ids = {zone_id for zone_id in zone_rights if zone_id is not None}
    for row in orders:
        item_day = row.scheduled_at.date()
        _place_item(
            _planner_order(row),
            item_day if item_day >= day_dates[0] else day_dates[0],
            zone_day_map=zone_day_map,
            unassigned_days=unassigned_days,
            active_zone_ids=active_zone_ids,
            known_zone_ids=known_zone_ids,
        )
    for row in inspections:
        _place_item(
            _planner_inspection(row),
            row.preferred_date,
            zone_day_map=zone_day_map,
            unassigned_days=unassigned_days,
            active_zone_ids=active_zone_ids,
            known_zone_ids=known_zone_ids,
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

    if full_access or (zone_rights.get(None) or {}).get("can_view"):
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

    return zone_rows


@router.get("/autoservice/planner/week", response_model=PlannerWeekResponse)
def get_planner_week(
    week_start: date = Query(..., alias="week_start"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_PLANNER)
    full_access, zone_rights = planner_zone_rights(db, current_user, org_id)
    start = _week_start(week_start)
    day_dates = [start + timedelta(days=offset) for offset in range(7)]
    zone_rows = _planner_zone_rows(db, org_id, day_dates, full_access, zone_rights)
    return PlannerWeekResponse(
        week_start=day_dates[0],
        week_end=day_dates[-1],
        days=[PlannerWeekDayHeader(date=day) for day in day_dates],
        zones=zone_rows,
    )


@router.get("/autoservice/planner/month", response_model=PlannerMonthResponse)
def get_planner_month(
    month_start: date = Query(..., alias="month_start"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Календарь на месяц: Monday-выровненная сетка дней без строк рабочих зон."""
    org_id = require_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_PLANNER)
    full_access, zone_rights = planner_zone_rights(db, current_user, org_id)
    first = month_start.replace(day=1)
    last = _month_last_day(first)
    grid_start = _week_start(first)
    grid_end = last + timedelta(days=6 - last.weekday())
    day_count = (grid_end - grid_start).days + 1
    day_dates = [grid_start + timedelta(days=offset) for offset in range(day_count)]
    zone_rows = _planner_zone_rows(db, org_id, day_dates, full_access, zone_rights)

    items_by_day: dict[date, list[PlannerRepairOrder]] = {day: [] for day in day_dates}
    for row in zone_rows:
        for row_day in row.days:
            items_by_day[row_day.date].extend(row_day.orders)

    return PlannerMonthResponse(
        month_start=first,
        grid_start=grid_start,
        grid_end=grid_end,
        days=[PlannerMonthDay(date=day, orders=items_by_day[day]) for day in day_dates],
        zones=[PlannerZoneRef(id=row.id, name=row.name) for row in zone_rows],
    )
