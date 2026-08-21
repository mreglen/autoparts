from __future__ import annotations

import secrets
import string
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, cast, or_
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.security import get_password_hash
from app.db.database import get_db
from app.models.autoservice_client import AutoserviceClient
from app.models.garage_vehicle import GarageVehicle
from app.models.inspection_booking import InspectionBooking
from app.models.organization import Organization
from app.models.repair_booking import RepairBooking
from app.models.repair_order import RepairOrder
from app.models.user import User
from app.schemas.autoservice_client import (
    AutoserviceClientCreateAccountResponse,
    AutoserviceClientMeResponse,
    AutoserviceClientStaffCreate,
    AutoserviceClientStaffUpdate,
    AutoserviceClientView,
)
from app.utils.autoservice_access import (
    AUTOSERVICE_PERMISSION_CLIENTS,
    display_client_phone,
    is_missing_phone_placeholder,
    missing_phone_placeholder,
    normalize_phone_or_400,
    normalize_phone_optional_or_400,
    require_autoservice_enabled,
    require_autoservice_org_id,
    require_autoservice_permission,
    storage_phone_or_placeholder,
    user_display_name,
)
from app.utils.email import send_autoservice_guest_account_email
from app.utils.user_avatar import resolve_user_by_contact
from app.utils.user_public_code import assign_public_code

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


def _inn_or_none(value: str | None) -> str | None:
    digits = _digits_or_none(value, 12)
    if digits is None:
        return None
    if len(digits) not in (10, 12):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ИНН: 10 или 12 цифр",
        )
    return digits


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


def _email_or_none(value: str | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip().lower()
    return text or None


def _apply_person_type_defaults(row: AutoserviceClient) -> None:
    person_type = row.person_type or "individual"
    if person_type == "individual":
        row.legal_name = None
        row.kpp = None
        row.ogrn = None
    elif person_type == "ie":
        row.kpp = None


def _client_view_with_account_email(db: Session, row: AutoserviceClient) -> AutoserviceClientView:
    view = AutoserviceClientView.model_validate(row)
    view.phone = display_client_phone(view.phone)
    if view.user_id and not (view.email or "").strip():
        user_email = (
            db.query(User.email)
            .filter(User.id == view.user_id)
            .scalar()
        )
        if user_email:
            view.email = user_email
    return view


def _format_vehicle_label(vehicle: GarageVehicle) -> str:
    parts = [vehicle.make, vehicle.model]
    if vehicle.year:
        parts.append(str(vehicle.year))
    base = " ".join(part for part in parts if part).strip()
    if vehicle.plate:
        return f"{base} ({vehicle.plate})" if base else str(vehicle.plate)
    return base or "Авто"


def _vehicle_search_clauses(term: str, raw: str):
    clauses = [
        GarageVehicle.make.ilike(term),
        GarageVehicle.model.ilike(term),
        GarageVehicle.plate.ilike(term),
        GarageVehicle.vin.ilike(term),
        GarageVehicle.color.ilike(term),
        GarageVehicle.notes.ilike(term),
        cast(GarageVehicle.year, String).ilike(term),
    ]
    digits = "".join(ch for ch in raw if ch.isdigit())
    if digits:
        clauses.append(GarageVehicle.plate.ilike(f"%{digits}%"))
        clauses.append(GarageVehicle.vin.ilike(f"%{digits}%"))
    return clauses


def _find_matching_vehicle(
    db: Session,
    org_id: str,
    client_id: int,
    q: str,
) -> GarageVehicle | None:
    raw = (q or "").strip()
    if not raw:
        return None
    term = f"%{raw}%"
    return (
        db.query(GarageVehicle)
        .filter(
            GarageVehicle.organization_id == org_id,
            GarageVehicle.client_id == client_id,
            or_(*_vehicle_search_clauses(term, raw)),
        )
        .order_by(GarageVehicle.id.desc())
        .first()
    )


def _client_search_view(
    db: Session,
    org_id: str,
    row: AutoserviceClient,
    q: str,
) -> AutoserviceClientView:
    view = _client_view_with_account_email(db, row)
    vehicle = _find_matching_vehicle(db, org_id, row.id, q)
    if not vehicle:
        return view
    return view.model_copy(
        update={
            "matched_vehicle_id": vehicle.id,
            "matched_vehicle_label": _format_vehicle_label(vehicle),
        }
    )


def _split_person_name(full_name: str) -> tuple[str, str, str | None]:
    parts = [part for part in (full_name or "").strip().split() if part]
    if len(parts) >= 3:
        return parts[0], parts[1], " ".join(parts[2:])
    if len(parts) == 2:
        return parts[0], parts[1], None
    if len(parts) == 1:
        return "", parts[0], None
    return "", "Клиент", None


def _generate_account_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _link_orphan_bookings(db: Session, org_id: str, client: AutoserviceClient) -> None:
    if not client.phone or is_missing_phone_placeholder(client.phone):
        return
    for model in (InspectionBooking, RepairBooking):
        db.query(model).filter(
            model.organization_id == org_id,
            model.client_id.is_(None),
            model.phone == client.phone,
        ).update({model.client_id: client.id}, synchronize_session=False)


def _apply_client_search_filter(query, org_id: str, q: str | None):
    if not q or not q.strip():
        return query

    raw = q.strip()
    term = f"%{raw}%"
    digits = "".join(ch for ch in raw if ch.isdigit())

    client_clauses = [
        AutoserviceClient.name.ilike(term),
        AutoserviceClient.phone.ilike(term),
        AutoserviceClient.email.ilike(term),
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
        client=_client_view_with_account_email(db, row),
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
        return _client_view_with_account_email(db, existing)

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
            return _client_view_with_account_email(db, by_phone)
        if by_phone.user_id == current_user.id:
            return _client_view_with_account_email(db, by_phone)
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
    return _client_view_with_account_email(db, row)


@router.get("/autoservice/clients", response_model=list[AutoserviceClientView])
def list_autoservice_clients(
    q: str | None = Query(None, max_length=120),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_CLIENTS)
    query = db.query(AutoserviceClient).filter(AutoserviceClient.organization_id == org_id)
    query = _apply_client_search_filter(query, org_id, q)
    rows = query.order_by(
        AutoserviceClient.consented_at.desc(),
        AutoserviceClient.id.desc(),
    ).all()
    q_norm = (q or "").strip()
    if q_norm:
        return [_client_search_view(db, org_id, row, q_norm) for row in rows]
    return [_client_view_with_account_email(db, row) for row in rows]


@router.post(
    "/autoservice/clients",
    response_model=AutoserviceClientView,
)
def create_autoservice_client_staff(
    payload: AutoserviceClientStaffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_CLIENTS)
    phone = storage_phone_or_placeholder(payload.phone)
    name = payload.name.strip()

    linked_user = None
    if not is_missing_phone_placeholder(phone):
        existing = _find_by_phone(db, org_id, phone)
        if existing:
            return _client_view_with_account_email(db, existing)

        linked_user = resolve_user_by_contact(db, phone, None)
        if linked_user:
            by_user = _find_by_user(db, org_id, linked_user.id)
            if by_user:
                return _client_view_with_account_email(db, by_user)

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
    return _client_view_with_account_email(db, row)


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
    org_id = require_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_CLIENTS)
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
            normalized = normalize_phone_optional_or_400(data["phone"])
            if normalized:
                existing = _find_by_phone(db, org_id, normalized)
                if existing and existing.id != row.id:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Этот телефон уже привязан к другому клиенту автосервиса",
                    )
                row.phone = normalized
            elif not is_missing_phone_placeholder(row.phone):
                row.phone = missing_phone_placeholder()

    if "email" in data:
        row.email = _email_or_none(data["email"])

    if "person_type" in data and data["person_type"]:
        row.person_type = data["person_type"]

    if "legal_name" in data:
        row.legal_name = _text_or_none(data["legal_name"])
    if "address" in data:
        row.address = _text_or_none(data["address"])
    if "inn" in data:
        row.inn = _inn_or_none(data["inn"])
    if "kpp" in data:
        row.kpp = _digits_or_none(data["kpp"], 9)
    if "ogrn" in data:
        row.ogrn = _digits_or_none(data["ogrn"], 15)

    _apply_person_type_defaults(row)
    db.commit()
    db.refresh(row)
    return _client_view_with_account_email(db, row)


@router.post(
    "/autoservice/clients/{client_id}/create-account",
    response_model=AutoserviceClientCreateAccountResponse,
)
def create_autoservice_client_account(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_CLIENTS)
    row = _get_org_client_or_404(db, org_id, client_id)

    if row.user_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="У клиента уже есть аккаунт",
        )

    email = _email_or_none(row.email)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Укажите email клиента перед созданием аккаунта",
        )

    existing_by_email = db.query(User).filter(User.email == email).first()
    if existing_by_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким email уже зарегистрирован",
        )

    if is_missing_phone_placeholder(row.phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Укажите телефон клиента перед созданием аккаунта",
        )

    phone = normalize_phone_or_400(row.phone)
    existing_by_phone = resolve_user_by_contact(db, phone, None)
    if existing_by_phone:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Телефон уже привязан к другому аккаунту",
        )

    password = _generate_account_password()
    last_name, first_name, patronymic = _split_person_name(row.name)
    user = User(
        last_name=last_name or None,
        first_name=first_name,
        patronymic=patronymic,
        email=email,
        phone=phone,
        is_buyer=True,
        hashed_password=get_password_hash(password),
    )
    assign_public_code(user, db)
    db.add(user)
    db.flush()

    row.user_id = user.id
    row.email = email
    row.phone = phone
    _link_orphan_bookings(db, org_id, row)

    organization = db.query(Organization).filter(Organization.id == org_id).first()
    org_name = organization.name if organization else None

    db.commit()
    db.refresh(row)
    db.refresh(user)

    email_sent = send_autoservice_guest_account_email(
        email=email,
        full_name=row.name,
        password=password,
        organization_name=org_name,
    )

    return AutoserviceClientCreateAccountResponse(
        client=_client_view_with_account_email(db, row),
        user_id=user.id,
        email=email,
        email_sent=email_sent,
    )
