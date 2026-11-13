from __future__ import annotations

from datetime import date
from io import BytesIO

from openpyxl import Workbook
from sqlalchemy.orm import Session

from app.services.autoservice_expense_service import (
    expense_type_label,
    list_autoservice_expenses,
    user_short_name,
)
from app.services.finance_xlsx_export import HEADER_FONT, _autosize_columns, _write_header, naive_datetime


def _sheet_summary(wb: Workbook, expenses, total_amount, date_from: date, date_to: date) -> None:
    ws = wb.active
    ws.title = "Сводка"
    ws["A1"] = "Расходы автосервиса"
    ws["A1"].font = HEADER_FONT
    ws["A2"] = "Период"
    ws["B2"] = f"{date_from.isoformat()} — {date_to.isoformat()}"

    row = 4
    metrics = [
        ("Записей", len(expenses)),
        ("Сумма, ₽", total_amount),
    ]
    by_type: dict[str, float] = {}
    for exp in expenses:
        label = exp.article.name if exp.article else expense_type_label(exp.type)
        by_type[label] = by_type.get(label, 0) + float(exp.amount)
    for expense_type in sorted(by_type):
        metrics.append((expense_type, by_type[expense_type]))

    for label, value in metrics:
        ws.cell(row=row, column=1, value=label)
        ws.cell(row=row, column=2, value=value)
        row += 1
    _autosize_columns(ws)


def _sheet_expenses(wb: Workbook, expenses) -> None:
    ws = wb.create_sheet("Расходы")
    headers = [
        "Дата",
        "Статья расхода",
        "Сумма, ₽",
        "Сотрудник",
        "Ответственный",
        "Описание",
        "Создан",
    ]
    _write_header(ws, headers)
    for index, exp in enumerate(expenses, start=2):
        ws.cell(row=index, column=1, value=exp.expense_date.date())
        ws.cell(row=index, column=2, value=exp.article.name if exp.article else expense_type_label(exp.type))
        ws.cell(row=index, column=3, value=exp.amount)
        ws.cell(row=index, column=4, value=exp.employee.name if exp.employee else "")
        ws.cell(row=index, column=5, value=user_short_name(exp.created_by))
        ws.cell(row=index, column=6, value=exp.description or "")
        ws.cell(row=index, column=7, value=naive_datetime(exp.created_at))
    _autosize_columns(ws)


def build_finance_expenses_workbook_bytes(
    db: Session,
    org_id: str,
    date_from: date,
    date_to: date,
) -> bytes:
    expenses, total_amount = list_autoservice_expenses(db, org_id, date_from, date_to)
    wb = Workbook()
    _sheet_summary(wb, expenses, total_amount, date_from, date_to)
    _sheet_expenses(wb, expenses)
    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()
