from __future__ import annotations

import secrets
import string
from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.models.autoservice_service_employee import AutoserviceServiceEmployee
from app.models.organization import Organization
from app.models.organization_employee import (
    OrganizationEmployee,
    OrganizationEmployeePayrollTerm,
    OrganizationEmployeePermission,
)
from app.models.permission import Permission
from app.models.user import User
from app.models.user_permission import UserPermission
from app.models.user_session import UserSession
from app.services.organization_employee_sync import person_name
from app.utils.email import send_employee_account_email
from app.utils.phone import normalize_to_storage_format
from app.utils.user_public_code import assign_public_code


def _money(value: Decimal | float | int) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"))


def _generate_account_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _normalize_email(value: str | None) -> str | None:
    if not value or not str(value).strip():
        return None
    return str(value).lower().strip()


def _normalize_phone(value: str | None) -> str | None:
    if not value or not str(value).strip():
        return None
    normalized = normalize_to_storage_format(value)
    if not normalized:
        raise HTTPException(status_code=400, detail="Неверный формат телефона")
    return normalized


def _get_card_or_404(db: Session, org_id: str, card_id: int) -> OrganizationEmployee:
    row = (
        db.query(OrganizationEmployee)
        .filter(
            OrganizationEmployee.id == card_id,
            OrganizationEmployee.organization_id == org_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    return row


def _current_payroll(card: OrganizationEmployee) -> OrganizationEmployeePayrollTerm | None:
    terms = card.payroll_terms or []
    if not terms:
        return None
    active = [t for t in terms if t.effective_to is None]
    return active[0] if active else terms[0]


def _payroll_from_legacy(card: OrganizationEmployee) -> tuple[str | None, Decimal | None, Decimal | None]:
    legacy = card.legacy_service_employee
    if not legacy:
        return None, None, None
    return legacy.salary_type, _money(legacy.salary_amount), _money(legacy.work_percent)


def card_to_view(db: Session, card: OrganizationEmployee) -> dict:
    term = _current_payroll(card)
    salary_type = term.salary_type if term else None
    salary_amount = _money(term.salary_amount) if term else None
    work_percent = _money(term.work_percent) if term else None
    if not term and card.legacy_service_employee_id:
        salary_type, salary_amount, work_percent = _payroll_from_legacy(card)

    linked_user = card.user
    is_director = bool(linked_user and linked_user.is_director)
    account_status = card.account_status
    if card.user_id and account_status == "no_account":
        account_status = "linked"

    return {
        "id": card.id,
        "organization_id": card.organization_id,
        "user_id": card.user_id,
        "last_name": card.last_name or "",
        "first_name": card.first_name or "",
        "patronymic": card.patronymic,
        "phone": card.phone,
        "email": card.email,
        "position": card.position,
        "comment": card.comment,
        "is_service_executor": bool(card.is_service_executor),
        "is_active": bool(card.is_active),
        "account_status": account_status,
        "is_director": is_director,
        "salary_type": salary_type,
        "salary_amount": salary_amount,
        "work_percent": work_percent,
    }


def _upsert_payroll_term(
    db: Session,
    card: OrganizationEmployee,
    salary_type: str,
    salary_amount: Decimal,
    work_percent: Decimal,
) -> None:
    today = date.today()
    current = _current_payroll(card)
    if current and current.salary_type == salary_type and _money(current.salary_amount) == _money(salary_amount) and _money(current.work_percent) == _money(work_percent):
        return
    if current and current.effective_to is None:
        current.effective_to = today
    db.add(
        OrganizationEmployeePayrollTerm(
            organization_employee_id=card.id,
            salary_type=salary_type,
            salary_amount=_money(salary_amount),
            work_percent=_money(work_percent),
            effective_from=today,
        )
    )


def _sync_legacy_service_employee(
    db: Session,
    card: OrganizationEmployee,
    *,
    enabled: bool,
    salary_type: str = "percent_work",
    salary_amount: Decimal = Decimal("0"),
    work_percent: Decimal = Decimal("50"),
) -> None:
    if enabled:
        service_emp: AutoserviceServiceEmployee | None = None
        if card.legacy_service_employee_id:
            service_emp = (
                db.query(AutoserviceServiceEmployee)
                .filter(AutoserviceServiceEmployee.id == card.legacy_service_employee_id)
                .first()
            )
        display = person_name(card.last_name, card.first_name, card.patronymic) or card.email or "Сотрудник"
        if not service_emp:
            service_emp = AutoserviceServiceEmployee(
                organization_id=card.organization_id,
                name=display[:120],
                phone=card.phone,
                position=card.position,
                is_active=True,
            )
            db.add(service_emp)
            db.flush()
            card.legacy_service_employee_id = service_emp.id
        service_emp.is_active = True
        service_emp.name = display[:120]
        service_emp.phone = card.phone
        service_emp.position = card.position
        service_emp.salary_type = salary_type
        service_emp.salary_amount = _money(salary_amount)
        service_emp.work_percent = _money(work_percent)
        card.is_service_executor = True
    elif card.legacy_service_employee_id:
        service_emp = (
            db.query(AutoserviceServiceEmployee)
            .filter(AutoserviceServiceEmployee.id == card.legacy_service_employee_id)
            .first()
        )
        if service_emp:
            service_emp.is_active = False
        card.is_service_executor = False


def list_employee_cards(db: Session, org_id: str, *, include_inactive: bool = False) -> list[dict]:
    query = db.query(OrganizationEmployee).filter(OrganizationEmployee.organization_id == org_id)
    if not include_inactive:
        query = query.filter(OrganizationEmployee.is_active.is_(True))
    rows = query.order_by(
        OrganizationEmployee.last_name.asc(),
        OrganizationEmployee.first_name.asc(),
        OrganizationEmployee.id.asc(),
    ).all()
    return [card_to_view(db, row) for row in rows]


def create_employee_card(db: Session, org_id: str, payload) -> dict:
    email = _normalize_email(payload.email)
    phone = _normalize_phone(payload.phone)
    if email:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")

    card = OrganizationEmployee(
        organization_id=org_id,
        last_name=payload.last_name.strip(),
        first_name=payload.first_name.strip(),
        patronymic=(payload.patronymic or "").strip() or None,
        phone=phone,
        email=email,
        position=(payload.position or "").strip() or None,
        comment=(payload.comment or "").strip() or None,
        is_service_executor=bool(payload.is_service_executor),
        is_active=True,
        account_status="no_account",
    )
    db.add(card)
    db.flush()

    if payload.is_service_executor:
        salary_type = payload.salary_type
        salary_amount = _money(payload.salary_amount)
        work_percent = _money(payload.work_percent if salary_type == "percent_work" else payload.work_percent)
        if salary_type == "percent_work" and work_percent <= 0:
            work_percent = Decimal("50")
        _upsert_payroll_term(db, card, salary_type, salary_amount, work_percent)
        _sync_legacy_service_employee(
            db,
            card,
            enabled=True,
            salary_type=salary_type,
            salary_amount=salary_amount,
            work_percent=work_percent,
        )

    db.commit()
    db.refresh(card)
    return card_to_view(db, card)


def update_employee_card(db: Session, org_id: str, card_id: int, payload) -> dict:
    card = _get_card_or_404(db, org_id, card_id)
    data = payload.model_dump(exclude_unset=True)

    if "email" in data:
        email = _normalize_email(data.pop("email"))
        if email:
            existing = db.query(User).filter(User.email == email, User.id != (card.user_id or -1)).first()
            if existing:
                raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
        card.email = email

    if "phone" in data:
        card.phone = _normalize_phone(data.pop("phone"))

    for field in ("last_name", "first_name", "patronymic", "position", "comment", "is_active"):
        if field in data:
            value = data.pop(field)
            if field in ("last_name", "first_name", "position") and value is not None:
                value = str(value).strip()
            if field == "patronymic" and value is not None:
                value = str(value).strip() or None
            setattr(card, field, value)

    service_flag = data.pop("is_service_executor", None)
    salary_type = data.pop("salary_type", None)
    salary_amount = data.pop("salary_amount", None)
    work_percent = data.pop("work_percent", None)

    if service_flag is not None or salary_type is not None or salary_amount is not None or work_percent is not None:
        enabled = bool(service_flag if service_flag is not None else card.is_service_executor)
        term = _current_payroll(card)
        resolved_type = salary_type or (term.salary_type if term else "percent_work")
        resolved_amount = _money(salary_amount if salary_amount is not None else (term.salary_amount if term else 0))
        resolved_percent = _money(
            work_percent if work_percent is not None else (term.work_percent if term else Decimal("50"))
        )
        if resolved_type == "percent_work" and resolved_percent <= 0:
            resolved_percent = Decimal("50")
        if enabled:
            _upsert_payroll_term(db, card, resolved_type, resolved_amount, resolved_percent)
            _sync_legacy_service_employee(
                db,
                card,
                enabled=True,
                salary_type=resolved_type,
                salary_amount=resolved_amount,
                work_percent=resolved_percent,
            )
        else:
            _sync_legacy_service_employee(db, card, enabled=False)

    if card.user_id:
        user = db.query(User).filter(User.id == card.user_id).first()
        if user:
            user.last_name = card.last_name
            user.first_name = card.first_name
            user.patronymic = card.patronymic
            user.phone = card.phone
            if card.email:
                user.email = card.email

    db.commit()
    db.refresh(card)
    return card_to_view(db, card)


def archive_employee_card(db: Session, org_id: str, card_id: int) -> None:
    card = _get_card_or_404(db, org_id, card_id)
    card.is_active = False
    _sync_legacy_service_employee(db, card, enabled=False)
    db.commit()


def get_card_permissions(db: Session, org_id: str, card_id: int) -> list[int]:
    card = _get_card_or_404(db, org_id, card_id)
    if card.user_id:
        rows = db.query(UserPermission.permission_id).filter(UserPermission.user_id == card.user_id).all()
        return [row[0] for row in rows]
    rows = (
        db.query(OrganizationEmployeePermission.permission_id)
        .filter(OrganizationEmployeePermission.organization_employee_id == card.id)
        .all()
    )
    return [row[0] for row in rows]


def _sync_card_permissions_to_user(db: Session, card: OrganizationEmployee, user_id: int) -> None:
    perm_ids = [
        row.permission_id
        for row in db.query(OrganizationEmployeePermission)
        .filter(OrganizationEmployeePermission.organization_employee_id == card.id)
        .all()
    ]
    db.query(UserPermission).filter(UserPermission.user_id == user_id).delete()
    for perm_id in perm_ids:
        db.add(UserPermission(user_id=user_id, permission_id=perm_id))


def set_card_permissions(db: Session, org_id: str, card_id: int, permission_ids: list[int]) -> None:
    card = _get_card_or_404(db, org_id, card_id)
    db.query(OrganizationEmployeePermission).filter(
        OrganizationEmployeePermission.organization_employee_id == card.id
    ).delete()
    for perm_id in permission_ids:
        if db.query(Permission).filter(Permission.id == perm_id).first():
            db.add(
                OrganizationEmployeePermission(
                    organization_employee_id=card.id,
                    permission_id=perm_id,
                )
            )
    if card.user_id:
        _sync_card_permissions_to_user(db, card, card.user_id)
        db.query(UserSession).filter(
            UserSession.user_id == card.user_id,
            UserSession.is_active.is_(True),
        ).update({"is_active": False})
    db.commit()


def create_employee_account(db: Session, org_id: str, card_id: int) -> dict:
    card = _get_card_or_404(db, org_id, card_id)
    if card.user_id:
        raise HTTPException(status_code=400, detail="У сотрудника уже есть аккаунт")
    email = _normalize_email(card.email)
    if not email:
        raise HTTPException(status_code=400, detail="Укажите email перед созданием аккаунта")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail="Пользователь с таким email уже зарегистрирован. Требуется подтверждение владельцем для привязки.",
        )

    phone = _normalize_phone(card.phone) if card.phone else None
    if phone:
        phone_user = db.query(User).filter(User.phone == phone).first()
        if phone_user:
            raise HTTPException(status_code=409, detail="Телефон уже привязан к другому аккаунту")

    password = _generate_account_password()
    user = User(
        last_name=card.last_name or "",
        first_name=card.first_name or "",
        patronymic=card.patronymic,
        email=email,
        phone=phone or "",
        hashed_password=get_password_hash(password),
        is_employee=True,
        is_seller=False,
        is_buyer=False,
        is_director=False,
        organization_id=org_id,
        must_change_password=True,
    )
    assign_public_code(user, db)
    db.add(user)
    db.flush()

    card.user_id = user.id
    card.account_status = "linked"
    card.email = email
    if phone:
        card.phone = phone

    _sync_card_permissions_to_user(db, card, user.id)

    from app.services.organization_chat_service import on_user_joined_organization
    on_user_joined_organization(db, user)

    org = db.query(Organization).filter(Organization.id == org_id).first()
    org_name = org.name if org else None
    full_name = person_name(card.last_name, card.first_name, card.patronymic)

    db.commit()
    db.refresh(user)

    email_sent = send_employee_account_email(
        email=email,
        full_name=full_name,
        password=password,
        organization_name=org_name,
    )

    return {
        "ok": True,
        "user_id": user.id,
        "email_sent": email_sent,
        "message": "Аккаунт создан и пароль отправлен на email" if email_sent else "Аккаунт создан, но письмо не удалось отправить",
    }
