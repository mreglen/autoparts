from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_contractor import AutoserviceContractor
from app.models.user import User
from app.schemas.autoservice_contractor import (
    AutoserviceContractorCreate,
    AutoserviceContractorStats,
    AutoserviceContractorUpdate,
    AutoserviceContractorView,
    RequisiteSetsView,
)
from app.services.autoservice_audit import log_autoservice
from app.services.autoservice_contractor_payouts import compute_contractor_stats
from app.utils.autoservice_access import (
    AUTOSERVICE_PERMISSION_ORDERS,
    AUTOSERVICE_PERMISSION_PLANNER,
    AUTOSERVICE_PERMISSION_SETTINGS,
    require_any_autoservice_permission,
    require_autoservice_director,
    require_autoservice_settings,
)
from app.utils.requisite_sets import apply_requisite_sets, requisite_sets_from_obj

router = APIRouter(tags=["Autoservice contractors"])


def _view(row: AutoserviceContractor) -> AutoserviceContractorView:
    return AutoserviceContractorView(
        id=row.id,
        name=row.name,
        phone=row.phone,
        note=row.note,
        is_active=row.is_active,
        requisite_sets=RequisiteSetsView.model_validate(requisite_sets_from_obj(row)),
    )


def _get_org_contractor_or_404(
    db: Session, org_id: str, contractor_id: int
) -> AutoserviceContractor:
    row = (
        db.query(AutoserviceContractor)
        .filter(
            AutoserviceContractor.id == contractor_id,
            AutoserviceContractor.organization_id == org_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Подрядчик не найден")
    return row


def _name_taken(db: Session, org_id: str, name: str, exclude_id: int | None = None) -> bool:
    query = db.query(AutoserviceContractor.id).filter(
        AutoserviceContractor.organization_id == org_id,
        AutoserviceContractor.name == name,
    )
    if exclude_id is not None:
        query = query.filter(AutoserviceContractor.id != exclude_id)
    return query.first() is not None


@router.get("/autoservice/contractors", response_model=list[AutoserviceContractorView])
def list_contractors(
    include_inactive: bool = Query(False),
    q: str = Query(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_any_autoservice_permission(
        db,
        current_user,
        AUTOSERVICE_PERMISSION_ORDERS,
        AUTOSERVICE_PERMISSION_PLANNER,
        AUTOSERVICE_PERMISSION_SETTINGS,
    )
    query = db.query(AutoserviceContractor).filter(
        AutoserviceContractor.organization_id == org_id,
    )
    if not include_inactive:
        query = query.filter(AutoserviceContractor.is_active.is_(True))
    term = (q or "").strip()
    if term:
        like = f"%{term}%"
        query = query.filter(
            or_(
                AutoserviceContractor.name.ilike(like),
                AutoserviceContractor.inn_legal.ilike(like),
                AutoserviceContractor.inn_ie.ilike(like),
                AutoserviceContractor.inn_individual.ilike(like),
            )
        )
    rows = query.order_by(AutoserviceContractor.name.asc(), AutoserviceContractor.id.asc()).all()
    return [_view(row) for row in rows]


@router.post(
    "/autoservice/contractors",
    response_model=AutoserviceContractorView,
    status_code=status.HTTP_201_CREATED,
)
def create_contractor(
    payload: AutoserviceContractorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_settings(db, current_user)
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Укажите наименование")
    if _name_taken(db, org_id, name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Подрядчик с таким наименованием уже есть",
        )
    row = AutoserviceContractor(
        organization_id=org_id,
        name=name,
        phone=payload.phone,
        note=payload.note,
        is_active=True,
    )
    apply_requisite_sets(row, payload.requisite_sets)
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Подрядчик с таким наименованием уже есть",
        )
    db.refresh(row)
    log_autoservice(
        db,
        event_type="contractor_created",
        summary=f"Создан подрядчик «{row.name}»",
        user=current_user,
        organization_id=org_id,
        entity_type="contractor",
        entity_id=row.id,
    )
    return _view(row)


@router.patch(
    "/autoservice/contractors/{contractor_id}",
    response_model=AutoserviceContractorView,
)
def update_contractor(
    contractor_id: int,
    payload: AutoserviceContractorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_settings(db, current_user)
    row = _get_org_contractor_or_404(db, org_id, contractor_id)
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Наименование пустое")
        if _name_taken(db, org_id, name, exclude_id=row.id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Подрядчик с таким наименованием уже есть",
            )
        row.name = name
    if payload.phone is not None:
        row.phone = payload.phone or None
    if payload.note is not None:
        row.note = payload.note or None
    if payload.requisite_sets is not None:
        apply_requisite_sets(row, payload.requisite_sets)
    if payload.is_active is not None:
        row.is_active = payload.is_active
    db.commit()
    db.refresh(row)
    log_autoservice(
        db,
        event_type="contractor_updated",
        summary=f"Подрядчик «{row.name}» обновлён",
        user=current_user,
        organization_id=org_id,
        entity_type="contractor",
        entity_id=row.id,
        details={
            "is_active": row.is_active,
            "fields": sorted(payload.model_dump(exclude_none=True, exclude={"requisite_sets"})),
        },
    )
    return _view(row)


@router.get(
    "/autoservice/contractors/{contractor_id}/stats",
    response_model=AutoserviceContractorStats,
)
def contractor_stats(
    contractor_id: int,
    period: str = Query("month", pattern="^(day|week|month|year)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_director(db, current_user)
    row = _get_org_contractor_or_404(db, org_id, contractor_id)
    data = compute_contractor_stats(db, org_id, row.id, period)
    return AutoserviceContractorStats.model_validate(data)
