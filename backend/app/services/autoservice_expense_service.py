from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from app.models.autoservice_expense import AutoserviceExpense
from app.models.user import User
from app.schemas.autoservice_finance import AutoserviceExpenseRow

EXPENSE_TYPE_LABELS = {"salary": "Зарплата", "other": "Прочее"}


def expense_type_label(expense_type: str) -> str:
    return EXPENSE_TYPE_LABELS.get(expense_type, expense_type)


def user_short_name(user: User | None) -> str:
    if not user:
        return ""
    if user.first_name:
        return f"{user.last_name} {user.first_name[0]}."
    return user.last_name or ""


def autoservice_expense_row(expense: AutoserviceExpense) -> AutoserviceExpenseRow:
    return AutoserviceExpenseRow(
        id=expense.id,
        type=expense.type,
        type_label=expense_type_label(expense.type),
        amount=expense.amount,
        expense_date=expense.expense_date.date(),
        description=expense.description,
        employee_id=expense.employee_id,
        employee_name=expense.employee.name if expense.employee else None,
        created_by_user_id=expense.created_by_user_id,
        created_by_name=user_short_name(expense.created_by),
        created_at=expense.created_at,
    )


def list_autoservice_expenses(
    db: Session,
    org_id: str,
    date_from: date,
    date_to: date,
) -> tuple[list[AutoserviceExpense], Decimal]:
    start = datetime.combine(date_from, time.min)
    end = datetime.combine(date_to, time.max)
    expenses = (
        db.query(AutoserviceExpense)
        .options(
            joinedload(AutoserviceExpense.employee),
            joinedload(AutoserviceExpense.created_by),
        )
        .filter(
            AutoserviceExpense.organization_id == org_id,
            AutoserviceExpense.is_deleted == False,  # noqa: E712
            AutoserviceExpense.expense_date >= start,
            AutoserviceExpense.expense_date <= end,
        )
        .order_by(AutoserviceExpense.expense_date.desc(), AutoserviceExpense.created_at.desc())
        .all()
    )
    total_amount = sum((exp.amount for exp in expenses), Decimal("0.00"))
    return expenses, total_amount
