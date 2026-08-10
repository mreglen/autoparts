from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_work import AutoserviceWork
from app.models.user import User
from app.schemas.autoservice_work import AutoserviceWorkCreate, AutoserviceWorkUpdate, AutoserviceWorkView
from app.utils.autoservice_access import require_autoservice_director, require_autoservice_staff

router = APIRouter(tags=["Autoservice works"])


def _get_org_work_or_404(db: Session, org_id: str, work_id: int) -> AutoserviceWork:
    row = (
        db.query(AutoserviceWork)
        .filter(
            AutoserviceWork.id == work_id,
            AutoserviceWork.organization_id == org_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Работа не найдена")
    return row


@router.get("/autoservice/works", response_model=list[AutoserviceWorkView])
def list_autoservice_works(
    q: str | None = Query(None),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    query = db.query(AutoserviceWork).filter(AutoserviceWork.organization_id == org_id)
    if not include_inactive:
        query = query.filter(AutoserviceWork.is_active.is_(True))
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(AutoserviceWork.name.ilike(term))
    rows = query.order_by(AutoserviceWork.sort_order.asc(), AutoserviceWork.name.asc()).all()
    return [AutoserviceWorkView.model_validate(row) for row in rows]


@router.post(
    "/autoservice/works",
    response_model=AutoserviceWorkView,
    status_code=status.HTTP_201_CREATED,
)
def create_autoservice_work(
    payload: AutoserviceWorkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    name = payload.name.strip()
    exists = (
        db.query(AutoserviceWork.id)
        .filter(
            AutoserviceWork.organization_id == org_id,
            AutoserviceWork.name == name,
        )
        .first()
    )
    if exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Такая работа уже есть",
        )
    max_sort = (
        db.query(AutoserviceWork.sort_order)
        .filter(AutoserviceWork.organization_id == org_id)
        .order_by(AutoserviceWork.sort_order.desc())
        .first()
    )
    row = AutoserviceWork(
        organization_id=org_id,
        name=name,
        default_unit_price=payload.default_unit_price,
        sort_order=(max_sort[0] + 1) if max_sort else 1,
        is_active=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return AutoserviceWorkView.model_validate(row)


@router.patch("/autoservice/works/{work_id}", response_model=AutoserviceWorkView)
def update_autoservice_work(
    work_id: int,
    payload: AutoserviceWorkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_director(db, current_user)
    row = _get_org_work_or_404(db, org_id, work_id)
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Название пустое")
        duplicate = (
            db.query(AutoserviceWork.id)
            .filter(
                AutoserviceWork.organization_id == org_id,
                AutoserviceWork.name == name,
                AutoserviceWork.id != work_id,
            )
            .first()
        )
        if duplicate:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Такая работа уже есть")
        row.name = name
    if payload.default_unit_price is not None:
        row.default_unit_price = payload.default_unit_price
    if payload.is_active is not None:
        row.is_active = payload.is_active
    db.commit()
    db.refresh(row)
    return AutoserviceWorkView.model_validate(row)


@router.delete("/autoservice/works/{work_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_autoservice_work(
    work_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_director(db, current_user)
    row = _get_org_work_or_404(db, org_id, work_id)
    row.is_active = False
    db.commit()
