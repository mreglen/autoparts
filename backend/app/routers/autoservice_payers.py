from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_payer import AutoservicePayer
from app.models.autoservice_payment import AutoservicePayment
from app.models.user import User
from app.schemas.autoservice_payer import (
    AutoservicePayerCreate,
    AutoservicePayerUpdate,
    AutoservicePayerView,
)
from app.utils.autoservice_access import (
    AUTOSERVICE_PERMISSION_ORDERS,
    AUTOSERVICE_PERMISSION_ORDERS_OWN,
    AUTOSERVICE_PERMISSION_SETTINGS,
    require_any_autoservice_permission,
    require_autoservice_settings,
)

router = APIRouter(tags=["Autoservice payers"])


def _get_org_payer_or_404(db: Session, org_id: str, payer_id: int) -> AutoservicePayer:
    row = (
        db.query(AutoservicePayer)
        .filter(
            AutoservicePayer.id == payer_id,
            AutoservicePayer.organization_id == org_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Плательщик не найден")
    return row


def _normalize_name(name: str) -> str:
    return (name or "").strip()[:255]


@router.get("/autoservice/payers", response_model=list[AutoservicePayerView])
def list_autoservice_payers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_any_autoservice_permission(
        db,
        current_user,
        AUTOSERVICE_PERMISSION_ORDERS,
        AUTOSERVICE_PERMISSION_ORDERS_OWN,
        AUTOSERVICE_PERMISSION_SETTINGS,
    )
    rows = (
        db.query(AutoservicePayer)
        .filter(AutoservicePayer.organization_id == org_id)
        .order_by(AutoservicePayer.name.asc(), AutoservicePayer.id.asc())
        .all()
    )
    return [AutoservicePayerView.model_validate(row) for row in rows]


@router.post(
    "/autoservice/payers",
    response_model=AutoservicePayerView,
    status_code=status.HTTP_201_CREATED,
)
def create_autoservice_payer(
    payload: AutoservicePayerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_any_autoservice_permission(
        db,
        current_user,
        AUTOSERVICE_PERMISSION_ORDERS,
        AUTOSERVICE_PERMISSION_ORDERS_OWN,
        AUTOSERVICE_PERMISSION_SETTINGS,
    )
    name = _normalize_name(payload.name)
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Введите имя плательщика",
        )
    exists = (
        db.query(AutoservicePayer.id)
        .filter(
            AutoservicePayer.organization_id == org_id,
            AutoservicePayer.name == name,
        )
        .first()
    )
    if exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Плательщик с таким именем уже существует",
        )
    row = AutoservicePayer(organization_id=org_id, name=name)
    db.add(row)
    db.commit()
    db.refresh(row)
    return AutoservicePayerView.model_validate(row)


@router.patch("/autoservice/payers/{payer_id}", response_model=AutoservicePayerView)
def update_autoservice_payer(
    payer_id: int,
    payload: AutoservicePayerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_settings(db, current_user)
    row = _get_org_payer_or_404(db, org_id, payer_id)
    name = _normalize_name(payload.name)
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Введите имя плательщика",
        )
    duplicate = (
        db.query(AutoservicePayer.id)
        .filter(
            AutoservicePayer.organization_id == org_id,
            AutoservicePayer.name == name,
            AutoservicePayer.id != payer_id,
        )
        .first()
    )
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Плательщик с таким именем уже существует",
        )
    row.name = name
    db.commit()
    db.refresh(row)
    return AutoservicePayerView.model_validate(row)


@router.delete("/autoservice/payers/{payer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_autoservice_payer(
    payer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_settings(db, current_user)
    row = _get_org_payer_or_404(db, org_id, payer_id)
    (
        db.query(AutoservicePayment)
        .filter(
            AutoservicePayment.organization_id == org_id,
            AutoservicePayment.payer_id == payer_id,
        )
        .update({AutoservicePayment.payer_id: None}, synchronize_session=False)
    )
    db.delete(row)
    db.commit()
    return None
