from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_lift import AutoserviceLift
from app.models.garage_vehicle import GarageVehicle
from app.models.repair_order import RepairOrder
from app.models.user import User
from app.schemas.autoservice_lift import (
    AutoserviceLiftCreate,
    AutoserviceLiftStats,
    AutoserviceLiftStatsOrder,
    AutoserviceLiftUpdate,
    AutoserviceLiftView,
)
from app.services.autoservice_lift_helpers import next_lift_name
from app.utils.autoservice_access import require_autoservice_director, require_autoservice_staff

router = APIRouter(tags=["Autoservice lifts"])


def _vehicle_label(vehicle: GarageVehicle | None) -> str:
    if not vehicle:
        return "—"
    parts = [vehicle.make, vehicle.model]
    label = " ".join(p for p in parts if p).strip()
    if vehicle.plate:
        label = f"{label} ({vehicle.plate})" if label else vehicle.plate
    return label or "—"


def _get_org_lift_or_404(db: Session, org_id: str, lift_id: int) -> AutoserviceLift:
    row = (
        db.query(AutoserviceLift)
        .filter(
            AutoserviceLift.id == lift_id,
            AutoserviceLift.organization_id == org_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Подъёмник не найден")
    return row


@router.get("/autoservice/lifts", response_model=list[AutoserviceLiftView])
def list_autoservice_lifts(
    include_archived: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    query = db.query(AutoserviceLift).filter(AutoserviceLift.organization_id == org_id)
    if not include_archived:
        query = query.filter(AutoserviceLift.is_active.is_(True))
    rows = query.order_by(AutoserviceLift.sort_order.asc(), AutoserviceLift.id.asc()).all()
    return [AutoserviceLiftView.model_validate(row) for row in rows]


@router.post(
    "/autoservice/lifts",
    response_model=AutoserviceLiftView,
    status_code=status.HTTP_201_CREATED,
)
def create_autoservice_lift(
    payload: AutoserviceLiftCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_director(db, current_user)
    default_name, sort_order = next_lift_name(db, org_id)
    name = (payload.name or "").strip() or default_name
    exists = (
        db.query(AutoserviceLift.id)
        .filter(
            AutoserviceLift.organization_id == org_id,
            AutoserviceLift.name == name,
        )
        .first()
    )
    if exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Подъёмник с таким названием уже существует",
        )
    row = AutoserviceLift(
        organization_id=org_id,
        name=name,
        sort_order=sort_order,
        is_active=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return AutoserviceLiftView.model_validate(row)


@router.patch("/autoservice/lifts/{lift_id}", response_model=AutoserviceLiftView)
def update_autoservice_lift(
    lift_id: int,
    payload: AutoserviceLiftUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_director(db, current_user)
    row = _get_org_lift_or_404(db, org_id, lift_id)
    name = payload.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Название не может быть пустым",
        )
    duplicate = (
        db.query(AutoserviceLift.id)
        .filter(
            AutoserviceLift.organization_id == org_id,
            AutoserviceLift.name == name,
            AutoserviceLift.id != lift_id,
        )
        .first()
    )
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Подъёмник с таким названием уже существует",
        )
    row.name = name
    db.commit()
    db.refresh(row)
    return AutoserviceLiftView.model_validate(row)


@router.delete("/autoservice/lifts/{lift_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_autoservice_lift(
    lift_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_director(db, current_user)
    row = _get_org_lift_or_404(db, org_id, lift_id)
    used = (
        db.query(RepairOrder.id)
        .filter(RepairOrder.lift_id == lift_id)
        .first()
    )
    if used:
        row.is_active = False
        row.archived_at = datetime.utcnow()
        db.commit()
        return None
    db.delete(row)
    db.commit()
    return None


@router.get("/autoservice/lifts/{lift_id}/stats", response_model=AutoserviceLiftStats)
def get_autoservice_lift_stats(
    lift_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    lift = _get_org_lift_or_404(db, org_id, lift_id)
    orders = (
        db.query(RepairOrder)
        .options(
            joinedload(RepairOrder.client),
            joinedload(RepairOrder.vehicle),
        )
        .filter(RepairOrder.lift_id == lift_id)
        .order_by(RepairOrder.scheduled_at.desc(), RepairOrder.id.desc())
        .all()
    )

    orders_by_status: dict[str, int] = {}
    busy_dates_set: set[date] = set()
    total_hours = 0.0
    orders_without_end_time = 0

    for order in orders:
        orders_by_status[order.status] = orders_by_status.get(order.status, 0) + 1
        if order.scheduled_at:
            busy_dates_set.add(order.scheduled_at.date())
        if order.scheduled_end_at and order.scheduled_at:
            if order.scheduled_end_at > order.scheduled_at:
                delta = order.scheduled_end_at - order.scheduled_at
                total_hours += delta.total_seconds() / 3600.0
            else:
                orders_without_end_time += 1
        else:
            orders_without_end_time += 1

    recent = [
        AutoserviceLiftStatsOrder(
            id=order.id,
            order_number=order.order_number,
            status=order.status,
            scheduled_at=order.scheduled_at,
            scheduled_end_at=order.scheduled_end_at,
            client_name=order.client.name if order.client else "—",
            vehicle=_vehicle_label(order.vehicle),
        )
        for order in orders[:20]
    ]

    return AutoserviceLiftStats(
        lift_id=lift.id,
        name=lift.name,
        total_orders=len(orders),
        orders_by_status=orders_by_status,
        busy_dates=sorted(busy_dates_set),
        total_hours=round(total_hours, 2),
        orders_without_end_time=orders_without_end_time,
        recent_orders=recent,
    )
