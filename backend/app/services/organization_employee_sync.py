from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.autoservice_service_employee import AutoserviceServiceEmployee
from app.models.organization_employee import (
    OrganizationEmployee,
    OrganizationEmployeePayrollTerm,
)
from app.models.user import User


def build_employee_response(db: Session, user: User):
    from app.schemas.user import UserResponse

    card = (
        get_card_by_user_id(db, user.organization_id, user.id)
        if user.organization_id
        else None
    )
    response = UserResponse.model_validate(user)
    return response.model_copy(
        update={"is_service_executor": bool(card and card.is_service_executor)},
    )


def person_name(last_name: str, first_name: str, patronymic: str | None = None) -> str:
    parts = [last_name or "", first_name or "", patronymic or ""]
    return " ".join(part.strip() for part in parts if part and part.strip()).strip()


def get_card_by_user_id(
    db: Session,
    org_id: str,
    user_id: int,
) -> OrganizationEmployee | None:
    return (
        db.query(OrganizationEmployee)
        .filter(
            OrganizationEmployee.organization_id == org_id,
            OrganizationEmployee.user_id == user_id,
        )
        .first()
    )


def get_card_by_service_employee_id(
    db: Session,
    service_employee_id: int,
) -> OrganizationEmployee | None:
    return (
        db.query(OrganizationEmployee)
        .filter(OrganizationEmployee.legacy_service_employee_id == service_employee_id)
        .first()
    )


def get_or_create_card_for_user(db: Session, user: User) -> OrganizationEmployee:
    if not user.organization_id:
        raise ValueError("User has no organization_id")
    card = get_card_by_user_id(db, user.organization_id, user.id)
    if card:
        return card
    card = OrganizationEmployee(
        organization_id=user.organization_id,
        user_id=user.id,
        last_name=user.last_name or "",
        first_name=user.first_name or "",
        patronymic=user.patronymic,
        phone=user.phone,
        email=user.email,
        is_service_executor=False,
        is_active=True,
        account_status="linked",
    )
    db.add(card)
    db.flush()
    return card


def _ensure_payroll_from_legacy(db: Session, card: OrganizationEmployee, legacy: AutoserviceServiceEmployee) -> None:
    if card.payroll_terms:
        return
    salary_type = legacy.salary_type if legacy.salary_type in ("percent_work", "fixed") else "percent_work"
    work_percent = legacy.work_percent if salary_type == "percent_work" else Decimal("0")
    if salary_type == "percent_work" and (not work_percent or work_percent <= 0):
        work_percent = Decimal("50")
    db.add(
        OrganizationEmployeePayrollTerm(
            organization_employee_id=card.id,
            salary_type=salary_type,
            salary_amount=legacy.salary_amount or Decimal("0"),
            work_percent=work_percent,
            effective_from=date.today(),
        )
    )


def sync_user_service_executor(
    db: Session,
    user: User,
    enabled: bool,
    *,
    work_percent: Decimal | None = None,
    salary_type: str = "percent_work",
    salary_amount: Decimal | None = None,
) -> OrganizationEmployee:
    card = get_or_create_card_for_user(db, user)
    card.is_service_executor = enabled
    card.last_name = user.last_name or card.last_name
    card.first_name = user.first_name or card.first_name
    card.patronymic = user.patronymic
    card.phone = user.phone
    card.email = user.email
    card.is_active = True

    if enabled:
        service_emp: AutoserviceServiceEmployee | None = None
        if card.legacy_service_employee_id:
            service_emp = (
                db.query(AutoserviceServiceEmployee)
                .filter(AutoserviceServiceEmployee.id == card.legacy_service_employee_id)
                .first()
            )
        display = person_name(card.last_name, card.first_name, card.patronymic) or user.email
        if not service_emp:
            service_emp = AutoserviceServiceEmployee(
                organization_id=user.organization_id,
                name=display[:120],
                phone=user.phone,
                is_active=True,
            )
            db.add(service_emp)
            db.flush()
            card.legacy_service_employee_id = service_emp.id
        else:
            service_emp.is_active = True
            service_emp.name = display[:120] or service_emp.name
            service_emp.phone = user.phone
        if work_percent is not None:
            service_emp.work_percent = work_percent
            service_emp.salary_type = salary_type
        if salary_amount is not None:
            service_emp.salary_amount = salary_amount
    elif card.legacy_service_employee_id:
        service_emp = (
            db.query(AutoserviceServiceEmployee)
            .filter(AutoserviceServiceEmployee.id == card.legacy_service_employee_id)
            .first()
        )
        if service_emp:
            service_emp.is_active = False
    return card


def link_service_employee_card(
    db: Session,
    service_employee: AutoserviceServiceEmployee,
) -> OrganizationEmployee:
    card = get_card_by_service_employee_id(db, service_employee.id)
    if card:
        card.is_service_executor = True
        card.is_active = bool(service_employee.is_active)
        _ensure_payroll_from_legacy(db, card, service_employee)
        return card
    card = OrganizationEmployee(
        organization_id=service_employee.organization_id,
        legacy_service_employee_id=service_employee.id,
        last_name="",
        first_name=service_employee.name,
        phone=service_employee.phone,
        position=service_employee.position,
        is_service_executor=True,
        is_active=bool(service_employee.is_active),
        account_status="no_account",
    )
    db.add(card)
    db.flush()
    _ensure_payroll_from_legacy(db, card, service_employee)
    return card


def service_employee_is_executor(db: Session, service_employee_id: int) -> bool:
    card = get_card_by_service_employee_id(db, service_employee_id)
    if not card:
        return False
    return bool(card.is_service_executor and card.is_active)


def user_is_service_executor(db: Session, user: User) -> bool:
    if not user.organization_id:
        return False
    card = get_card_by_user_id(db, user.organization_id, user.id)
    return bool(card and card.is_service_executor and card.is_active)


def backfill_organization_employee_cards(db: Session) -> None:
    """Idempotent: link legacy service employees and create cards for org users."""
    for service_employee in db.query(AutoserviceServiceEmployee).all():
        link_service_employee_card(db, service_employee)

    users = (
        db.query(User)
        .filter(User.organization_id.isnot(None))
        .filter((User.is_employee.is_(True)) | (User.is_director.is_(True)) | (User.is_seller.is_(True)))
        .all()
    )
    for user in users:
        card = get_or_create_card_for_user(db, user)
        if card.legacy_service_employee_id and not card.is_service_executor:
            card.is_service_executor = True
            legacy = (
                db.query(AutoserviceServiceEmployee)
                .filter(AutoserviceServiceEmployee.id == card.legacy_service_employee_id)
                .first()
            )
            if legacy:
                _ensure_payroll_from_legacy(db, card, legacy)

    db.commit()
