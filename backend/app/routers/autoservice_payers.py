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
    AUTOSERVICE_PERMISSION_FINANCE,
    AUTOSERVICE_PERMISSION_ORDERS,
    AUTOSERVICE_PERMISSION_ORDERS_OWN,
    AUTOSERVICE_PERMISSION_REPORTS,
    AUTOSERVICE_PERMISSION_SETTINGS,
    require_any_autoservice_permission,
    require_autoservice_settings,
)
from app.utils.autoservice_payer_requisites import (
    apply_person_type_defaults,
    payer_catalog_name,
    payer_catalog_name_from_row,
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


def _text_or_none(value: str | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _email_or_none(value: str | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip().lower()
    return text or None


def _payer_view(row: AutoservicePayer) -> AutoservicePayerView:
    view = AutoservicePayerView.model_validate(row)
    view.display_name = payer_catalog_name_from_row(row)
    return view


def _apply_payer_payload(row: AutoservicePayer, payload: AutoservicePayerCreate | AutoservicePayerUpdate) -> None:
    row.name = _normalize_name(payload.name)
    row.email = _email_or_none(payload.email)
    row.person_type = payload.person_type or "individual"
    row.legal_name = _text_or_none(payload.legal_name)
    row.address = _text_or_none(payload.address)
    row.inn = _text_or_none(payload.inn)
    row.kpp = _text_or_none(payload.kpp)
    row.ogrn = _text_or_none(payload.ogrn)
    apply_person_type_defaults(row)


def _ensure_unique_catalog_name(
    db: Session,
    org_id: str,
    catalog_name: str,
    *,
    exclude_id: int | None = None,
) -> None:
    if not catalog_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Введите имя плательщика",
        )
    rows = (
        db.query(AutoservicePayer)
        .filter(AutoservicePayer.organization_id == org_id)
        .all()
    )
    key = catalog_name.casefold()
    for row in rows:
        if exclude_id is not None and row.id == exclude_id:
            continue
        if payer_catalog_name_from_row(row).casefold() == key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Плательщик с таким именем уже существует",
            )


def _sync_payment_payers(db: Session, org_id: str) -> None:
    """Add historical manual payer snapshots to the reusable directory."""
    rows = (
        db.query(AutoservicePayment.payer_name)
        .filter(
            AutoservicePayment.organization_id == org_id,
            AutoservicePayment.payer_name.isnot(None),
        )
        .distinct()
        .all()
    )
    existing = {
        payer_catalog_name_from_row(row).casefold(): row
        for row in db.query(AutoservicePayer)
        .filter(AutoservicePayer.organization_id == org_id)
        .all()
        if payer_catalog_name_from_row(row)
    }
    changed = False
    for (raw_name,) in rows:
        name = _normalize_name(raw_name)
        if not name:
            continue
        key = name.casefold()
        payer = existing.get(key)
        if payer is None:
            payer = AutoservicePayer(organization_id=org_id, name=name)
            db.add(payer)
            db.flush()
            existing[key] = payer
            changed = True
        updated = (
            db.query(AutoservicePayment)
            .filter(
                AutoservicePayment.organization_id == org_id,
                AutoservicePayment.payer_id.is_(None),
                AutoservicePayment.payer_name == raw_name,
            )
            .update(
                {AutoservicePayment.payer_id: payer.id},
                synchronize_session=False,
            )
        )
        changed = changed or bool(updated)
    if changed:
        db.commit()


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
        AUTOSERVICE_PERMISSION_FINANCE,
        AUTOSERVICE_PERMISSION_REPORTS,
        AUTOSERVICE_PERMISSION_SETTINGS,
    )
    _sync_payment_payers(db, org_id)
    rows = (
        db.query(AutoservicePayer)
        .filter(AutoservicePayer.organization_id == org_id)
        .order_by(AutoservicePayer.name.asc(), AutoservicePayer.id.asc())
        .all()
    )
    rows.sort(key=lambda row: payer_catalog_name_from_row(row).casefold())
    return [_payer_view(row) for row in rows]


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
    row = AutoservicePayer(organization_id=org_id)
    _apply_payer_payload(row, payload)
    catalog_name = payer_catalog_name_from_row(row)
    _ensure_unique_catalog_name(db, org_id, catalog_name)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _payer_view(row)


@router.patch("/autoservice/payers/{payer_id}", response_model=AutoservicePayerView)
def update_autoservice_payer(
    payer_id: int,
    payload: AutoservicePayerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_settings(db, current_user)
    row = _get_org_payer_or_404(db, org_id, payer_id)
    _apply_payer_payload(row, payload)
    catalog_name = payer_catalog_name_from_row(row)
    _ensure_unique_catalog_name(db, org_id, catalog_name, exclude_id=row.id)
    db.commit()
    db.refresh(row)
    return _payer_view(row)


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
