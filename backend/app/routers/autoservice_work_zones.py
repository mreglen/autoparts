from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_work_zone import AutoserviceWorkZone
from app.models.repair_order import RepairOrder
from app.models.user import User
from app.schemas.autoservice_work_zone import (
    AutoserviceWorkZoneCreate,
    AutoserviceWorkZoneUpdate,
    AutoserviceWorkZoneView,
)
from app.services.autoservice_work_zone_helpers import next_work_zone_name
from app.utils.autoservice_access import (
    AUTOSERVICE_PERMISSION_INSPECTIONS,
    AUTOSERVICE_PERMISSION_ORDERS,
    AUTOSERVICE_PERMISSION_PLANNER,
    AUTOSERVICE_PERMISSION_SETTINGS,
    require_any_autoservice_permission,
    require_autoservice_settings,
)

router = APIRouter(tags=["Autoservice work zones"])


def _get_org_zone_or_404(db: Session, org_id: str, zone_id: int) -> AutoserviceWorkZone:
    row = (
        db.query(AutoserviceWorkZone)
        .filter(
            AutoserviceWorkZone.id == zone_id,
            AutoserviceWorkZone.organization_id == org_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Рабочая зона не найдена")
    return row


@router.get("/autoservice/work-zones", response_model=list[AutoserviceWorkZoneView])
def list_autoservice_work_zones(
    include_archived: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_any_autoservice_permission(
        db,
        current_user,
        AUTOSERVICE_PERMISSION_PLANNER,
        AUTOSERVICE_PERMISSION_ORDERS,
        AUTOSERVICE_PERMISSION_INSPECTIONS,
        AUTOSERVICE_PERMISSION_SETTINGS,
    )
    query = db.query(AutoserviceWorkZone).filter(AutoserviceWorkZone.organization_id == org_id)
    if not include_archived:
        query = query.filter(AutoserviceWorkZone.is_active.is_(True))
    rows = query.order_by(
        AutoserviceWorkZone.sort_order.asc(),
        AutoserviceWorkZone.id.asc(),
    ).all()
    return [AutoserviceWorkZoneView.model_validate(row) for row in rows]


@router.post(
    "/autoservice/work-zones",
    response_model=AutoserviceWorkZoneView,
    status_code=status.HTTP_201_CREATED,
)
def create_autoservice_work_zone(
    payload: AutoserviceWorkZoneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_settings(db, current_user)
    default_name, sort_order = next_work_zone_name(db, org_id)
    name = (payload.name or "").strip() or default_name
    exists = (
        db.query(AutoserviceWorkZone.id)
        .filter(
            AutoserviceWorkZone.organization_id == org_id,
            AutoserviceWorkZone.name == name,
        )
        .first()
    )
    if exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Рабочая зона с таким названием уже существует",
        )
    row = AutoserviceWorkZone(
        organization_id=org_id,
        name=name,
        sort_order=sort_order,
        is_active=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return AutoserviceWorkZoneView.model_validate(row)


@router.patch("/autoservice/work-zones/{zone_id}", response_model=AutoserviceWorkZoneView)
def update_autoservice_work_zone(
    zone_id: int,
    payload: AutoserviceWorkZoneUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_settings(db, current_user)
    row = _get_org_zone_or_404(db, org_id, zone_id)
    name = payload.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Название не может быть пустым",
        )
    duplicate = (
        db.query(AutoserviceWorkZone.id)
        .filter(
            AutoserviceWorkZone.organization_id == org_id,
            AutoserviceWorkZone.name == name,
            AutoserviceWorkZone.id != zone_id,
        )
        .first()
    )
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Рабочая зона с таким названием уже существует",
        )
    row.name = name
    db.commit()
    db.refresh(row)
    return AutoserviceWorkZoneView.model_validate(row)


@router.delete("/autoservice/work-zones/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_autoservice_work_zone(
    zone_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_settings(db, current_user)
    row = _get_org_zone_or_404(db, org_id, zone_id)
    used = (
        db.query(RepairOrder.id)
        .filter(RepairOrder.work_zone_id == zone_id)
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
