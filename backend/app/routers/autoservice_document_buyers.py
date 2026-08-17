from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_document_buyer import AutoserviceDocumentBuyer
from app.models.user import User
from app.schemas.autoservice_document_buyer import (
    AutoserviceDocumentBuyerCreate,
    AutoserviceDocumentBuyerUpdate,
    AutoserviceDocumentBuyerView,
)
from app.utils.autoservice_access import require_autoservice_staff

router = APIRouter(tags=["Autoservice document buyers"])


def _digits_or_none(value: str | None, max_len: int) -> str | None:
    if value is None:
        return None
    digits = "".join(ch for ch in str(value) if ch.isdigit())[:max_len]
    return digits or None


def _get_org_buyer_or_404(db: Session, org_id: str, buyer_id: int) -> AutoserviceDocumentBuyer:
    row = (
        db.query(AutoserviceDocumentBuyer)
        .filter(
            AutoserviceDocumentBuyer.id == buyer_id,
            AutoserviceDocumentBuyer.organization_id == org_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Покупатель не найден")
    return row


@router.get("/autoservice/document-buyers", response_model=list[AutoserviceDocumentBuyerView])
def list_document_buyers(
    q: str = Query(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    query = db.query(AutoserviceDocumentBuyer).filter(
        AutoserviceDocumentBuyer.organization_id == org_id,
    )
    term = (q or "").strip()
    if term:
        like = f"%{term}%"
        query = query.filter(
            or_(
                AutoserviceDocumentBuyer.name.ilike(like),
                AutoserviceDocumentBuyer.inn.ilike(like),
            )
        )
    rows = query.order_by(AutoserviceDocumentBuyer.name.asc(), AutoserviceDocumentBuyer.id.asc()).all()
    return [AutoserviceDocumentBuyerView.model_validate(row) for row in rows]


@router.get("/autoservice/document-buyers/{buyer_id}", response_model=AutoserviceDocumentBuyerView)
def get_document_buyer(
    buyer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    return AutoserviceDocumentBuyerView.model_validate(_get_org_buyer_or_404(db, org_id, buyer_id))


@router.post(
    "/autoservice/document-buyers",
    response_model=AutoserviceDocumentBuyerView,
    status_code=status.HTTP_201_CREATED,
)
def create_document_buyer(
    payload: AutoserviceDocumentBuyerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    row = AutoserviceDocumentBuyer(
        organization_id=org_id,
        name=payload.name.strip(),
        address=(payload.address or "").strip() or None,
        inn=_digits_or_none(payload.inn, 12),
        kpp=_digits_or_none(payload.kpp, 9),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return AutoserviceDocumentBuyerView.model_validate(row)


@router.patch("/autoservice/document-buyers/{buyer_id}", response_model=AutoserviceDocumentBuyerView)
def update_document_buyer(
    buyer_id: int,
    payload: AutoserviceDocumentBuyerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    row = _get_org_buyer_or_404(db, org_id, buyer_id)
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Укажите наименование")
        row.name = name
    if payload.address is not None:
        row.address = payload.address.strip() or None
    if payload.inn is not None:
        row.inn = _digits_or_none(payload.inn, 12)
    if payload.kpp is not None:
        row.kpp = _digits_or_none(payload.kpp, 9)
    db.commit()
    db.refresh(row)
    return AutoserviceDocumentBuyerView.model_validate(row)
