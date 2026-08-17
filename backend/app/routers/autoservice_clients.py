from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, cast, or_
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_client import AutoserviceClient
from app.models.garage_vehicle import GarageVehicle
from app.models.inspection_booking import InspectionBooking
from app.models.repair_booking import RepairBooking
from app.models.repair_order import RepairOrder
from app.models.user import User
from app.schemas.autoservice_client import (
    AutoserviceClientMeResponse,
    AutoserviceClientStaffCreate,
    AutoserviceClientStaffUpdate,
    AutoserviceClientView,
)
from app.utils.autoservice_access import (
    normalize_phone_or_400,
    require_autoservice_enabled,
    require_autoservice_org_id,
    require_autoservice_staff,
    user_display_name,
)
from app.utils.user_avatar import resolve_user_by_contact

router = APIRouter(tags=["Autoservice clients"])


def _find_by_user(db: Session, org_id: str, user_id: int) -> AutoserviceClient | None:
    return (
        db.query(AutoserviceClient)
        .filter(
            AutoserviceClient.organization_id == org_id,
            AutoserviceClient.user_id == user_id,
            AutoserviceClient.status == "active",
        )
        .first()
    )


def _find_by_phone(db: Session, org_id: str, phone: str) -> AutoserviceClient | None:
    return (
        db.query(AutoserviceClient)
        .filter(
            AutoserviceClient.organization_id == org_id,
            AutoserviceClient.phone == phone,
        )
        .first()
    )


def _digits_or_none(value: str | None, max_len: int) -> str | None:
    if value is None:
        return None
    digits = "".join(ch for ch in str(value) if ch.isdigit())[:max_len]
    return digits or None


def _text_or_none(value: str | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _get_org_client_or_404(db: Session, org_id: str, client_id: int) -> AutoserviceClient:
    row = (
        db.query(AutoserviceClient)
        .filter(
            AutoserviceClient.id == client_id,
            AutoserviceClient.organization_id == org_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Клиент не найден")
    return row


def _apply_person_type_defaults(row: AutoserviceClient) -> None:
    person_type = row.person_type or "individual"
    if person_type == "individual":
        row.legal_name = None
        row.kpp = None
        row.ogrn = None
    elif person_type == "ie":
        row.kpp = None


def _apply_client_search_filter(query, org_id: str, q: str | None):
    if not q or not q.strip():
        return query

    raw = q.strip()
    term = f"%{raw}%"
    digits = "".join(ch for ch in raw if ch.isdigit())

    client_clauses = [
        AutoserviceClient.name.ilike(term),
        AutoserviceClient.phone.ilike(term),
        AutoserviceClient.legal_name.ilike(term),
        AutoserviceClient.address.ilike(term),
        AutoserviceClient.inn.ilike(term),
        AutoserviceClient.kpp.ilike(term),
        AutoserviceClient.ogrn.ilike(term),
    ]
    if digits:
        client_clauses.append(AutoserviceClient.phone.ilike(f"%{digits}%"))
        client_clauses.append(AutoserviceClient.inn.ilike(f"%{digits}%"))
        client_clauses.append(AutoserviceClient.kpp.ilike(f"%{digits}%"))
        client_clauses.append(AutoserviceClient.ogrn.ilike(f"%{digits}%"))

    session = query.session

    vehicle_client_ids = (
        session.query(GarageVehicle.client_id)
        .filter(
            GarageVehicle.organization_id == org_id,
            or_(
                GarageVehicle.make.ilike(term),
                GarageVehicle.model.ilike(term),
                GarageVehicle.plate.ilike(term),
                GarageVehicle.vin.ilike(term),
                GarageVehicle.color.ilike(term),
                GarageVehicle.notes.ilike(term),
                cast(GarageVehicle.year, String).ilike(term),
            ),
        )
        .distinct()
    )
    client_clauses.append(AutoserviceClient.id.in_(vehicle_client_ids))

    order_client_ids = (
        session.query(RepairOrder.client_id)
        .filter(
            RepairOrder.organization_id == org_id,
            RepairOrder.order_number.ilike(term),
        )
        .distinct()
    )
    client_clauses.append(AutoserviceClient.id.in_(order_client_ids))

    booking_clauses = [
        InspectionBooking.name.ilike(term),
        InspectionBooking.phone.ilike(term),
        InspectionBooking.notes.ilike(term),
    ]
    if raw.isdigit():
        booking_clauses.append(InspectionBooking.id == int(raw))
    if digits:
        booking_clauses.append(InspectionBooking.phone.ilike(f"%{digits}%"))

    booking_client_ids = (
        session.query(InspectionBooking.client_id)
        .filter(
            InspectionBooking.organization_id == org_id,
            InspectionBooking.client_id.isnot(None),
            or_(*booking_clauses),
        )
        .distinct()
    )
    client_clauses.append(AutoserviceClient.id.in_(booking_client_ids))

    booking_phones = (
        session.query(InspectionBooking.phone)
        .filter(
            InspectionBooking.organization_id == org_id,
            or_(*booking_clauses),
        )
        .distinct()
    )
    client_clauses.append(AutoserviceClient.phone.in_(booking_phones))

    repair_booking_clauses = [
        RepairBooking.name.ilike(term),
        RepairBooking.phone.ilike(term),
        RepairBooking.comment.ilike(term),
    ]
    if raw.isdigit():
        repair_booking_clauses.append(RepairBooking.id == int(raw))
    if digits:
        repair_booking_clauses.append(RepairBooking.phone.ilike(f"%{digits}%"))

    repair_booking_client_ids = (
        session.query(RepairBooking.client_id)
        .filter(
            RepairBooking.organization_id == org_id,
            RepairBooking.client_id.isnot(None),
            or_(*repair_booking_clauses),
        )
        .distinct()
    )
    client_clauses.append(AutoserviceClient.id.in_(repair_booking_client_ids))

    repair_booking_phones = (
        session.query(RepairBooking.phone)
        .filter(
            RepairBooking.organization_id == org_id,
            or_(*repair_booking_clauses),
        )
        .distinct()
    )
    client_clauses.append(AutoserviceClient.phone.in_(repair_booking_phones))

    if raw.isdigit():
        client_clauses.append(AutoserviceClient.id == int(raw))

    return query.filter(or_(*client_clauses))


@router.get("/autoservice/clients/me", response_model=AutoserviceClientMeResponse)
def get_my_autoservice_client(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_autoservice_enabled(db)
    org_id = require_autoservice_org_id(db)
    row = _find_by_user(db, org_id, current_user.id)
    if not row:
        phone = None
        if current_user.phone:
            try:
                phone = normalize_phone_or_400(current_user.phone)
            except HTTPException:
                phone = None
        if phone:
            row = _find_by_phone(db, org_id, phone)
            if row and row.user_id is None:
                row.user_id = current_user.id
                db.commit()
                db.refresh(row)
            elif row and row.user_id != current_user.id:
                row = None
    if not row or row.status != "active":
        return AutoserviceClientMeResponse(is_client=False, client=None)
    return AutoserviceClientMeResponse(
        is_client=True,
        client=AutoserviceClientView.model_validate(row),
    )


@router.post("/autoservice/clients/me", response_model=AutoserviceClientView)
def become_autoservice_client(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_autoservice_enabled(db)
    org_id = require_autoservice_org_id(db)

    existing = _find_by_user(db, org_id, current_user.id)
    if existing:
        return AutoserviceClientView.model_validate(existing)

    if not current_user.phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Укажите телефон в профиле, чтобы стать клиентом автосервиса",
        )
    phone = normalize_phone_or_400(current_user.phone)

    by_phone = _find_by_phone(db, org_id, phone)
    if by_phone:
        if by_phone.user_id is None:
            by_phone.user_id = current_user.id
            by_phone.name = user_display_name(current_user)
            if by_phone.status != "active":
                by_phone.status = "active"
            db.commit()
            db.refresh(by_phone)
            return AutoserviceClientView.model_validate(by_phone)
        if by_phone.user_id == current_user.id:
            return AutoserviceClientView.model_validate(by_phone)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Этот телефон уже привязан к другому клиенту автосервиса",
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    row = AutoserviceClient(
        organization_id=org_id,
        user_id=current_user.id,
        name=user_display_name(current_user),
        phone=phone,
        person_type="individual",
        status="active",
        source="self",
        consented_at=now,
        created_by_user_id=current_user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return AutoserviceClientView.model_validate(row)


@router.get("/autoservice/clients", response_model=list[AutoserviceClientView])
def list_autoservice_clients(
    q: str | None = Query(None, max_length=120),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    query = db.query(AutoserviceClient).filter(AutoserviceClient.organization_id == org_id)
    query = _apply_client_search_filter(query, org_id, q)
    rows = query.order_by(
        AutoserviceClient.consented_at.desc(),
        AutoserviceClient.id.desc(),
    ).all()
    return [AutoserviceClientView.model_validate(row) for row in rows]


@router.post(
    "/autoservice/clients",
    response_model=AutoserviceClientView,
)
def create_autoservice_client_staff(
    payload: AutoserviceClientStaffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    phone = normalize_phone_or_400(payload.phone)
    name = payload.name.strip()

    existing = _find_by_phone(db, org_id, phone)
    if existing:
        return AutoserviceClientView.model_validate(existing)

    linked_user = resolve_user_by_contact(db, phone, None)
    if linked_user:
        by_user = _find_by_user(db, org_id, linked_user.id)
        if by_user:
            return AutoserviceClientView.model_validate(by_user)

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    row = AutoserviceClient(
        organization_id=org_id,
        user_id=linked_user.id if linked_user else None,
        name=name,
        phone=phone,
        person_type="individual",
        status="active",
        source="staff",
        consented_at=now,
        created_by_user_id=current_user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return AutoserviceClientView.model_validate(row)


@router.patch(
    "/autoservice/clients/{client_id}",
    response_model=AutoserviceClientView,
)
def update_autoservice_client_staff(
    client_id: int,
    payload: AutoserviceClientStaffUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    row = _get_org_client_or_404(db, org_id, client_id)
    data = payload.model_dump(exclude_unset=True)
    is_guest = row.user_id is None

    if "name" in data:
        if is_guest:
            name = (data["name"] or "").strip()
            if len(name) < 2:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Укажите имя",
                )
            row.name = name

    if "phone" in data:
        if is_guest:
            phone = normalize_phone_or_400(data["phone"])
            existing = _find_by_phone(db, org_id, phone)
            if existing and existing.id != row.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Этот телефон уже привязан к другому клиенту автосервиса",
                )
            row.phone = phone

    if "person_type" in data and data["person_type"]:
        row.person_type = data["person_type"]

    if "legal_name" in data:
        row.legal_name = _text_or_none(data["legal_name"])
    if "address" in data:
        row.address = _text_or_none(data["address"])
    if "inn" in data:
        row.inn = _digits_or_none(data["inn"], 12)
    if "kpp" in data:
        row.kpp = _digits_or_none(data["kpp"], 9)
    if "ogrn" in data:
        row.ogrn = _digits_or_none(data["ogrn"], 15)

    _apply_person_type_defaults(row)
    db.commit()
    db.refresh(row)
    return AutoserviceClientView.model_validate(row)
