import sys
import types
import unittest
from datetime import date, datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

import app.models  # noqa: F401
import app.models.autoservice_expense  # noqa: F401

import app.services.autoservice_finance_expenses_xlsx as expenses_xlsx
from app.schemas.autoservice_finance import (
    AutoserviceExpenseCreate,
    AutoserviceExpenseUpdate,
)
from app.services.autoservice_expense_service import (
    autoservice_expense_row,
    expense_type_label,
    user_short_name,
)


def _expense(**overrides):
    base = dict(
        id=1,
        type="salary",
        article_id=None,
        article=None,
        amount=Decimal("15000.00"),
        expense_date=datetime(2026, 10, 5, 0, 0),
        description="Октябрь",
        employee_id=7,
        employee=SimpleNamespace(name="Иван Петров"),
        created_by_user_id=3,
        created_by=SimpleNamespace(first_name="Admin", last_name="Root"),
        created_at=datetime(2026, 10, 5, 12, 30),
    )
    base.update(overrides)
    return SimpleNamespace(**base)


class ExpenseTypeLabelTests(unittest.TestCase):
    def test_known_types(self):
        self.assertEqual(expense_type_label("salary"), "Зарплата")
        self.assertEqual(expense_type_label("other"), "Прочее")

    def test_unknown_type_falls_back(self):
        self.assertEqual(expense_type_label("bonus"), "bonus")


class UserShortNameTests(unittest.TestCase):
    def test_none_user(self):
        self.assertEqual(user_short_name(None), "")

    def test_first_name_initial(self):
        user = SimpleNamespace(first_name="Иван", last_name="Петров")
        self.assertEqual(user_short_name(user), "Петров И.")

    def test_last_name_only(self):
        user = SimpleNamespace(first_name=None, last_name="Петров")
        self.assertEqual(user_short_name(user), "Петров")


class ExpenseRowTests(unittest.TestCase):
    def test_maps_fields(self):
        row = autoservice_expense_row(_expense())
        self.assertEqual(row.id, 1)
        self.assertEqual(row.type, "salary")
        self.assertEqual(row.type_label, "Зарплата")
        self.assertEqual(row.amount, Decimal("15000.00"))
        self.assertEqual(row.expense_date, date(2026, 10, 5))
        self.assertEqual(row.employee_name, "Иван Петров")
        self.assertEqual(row.created_by_name, "Root A.")
        self.assertEqual(row.created_by_user_id, 3)

    def test_other_type_without_employee(self):
        row = autoservice_expense_row(
            _expense(type="other", employee_id=None, employee=None)
        )
        self.assertEqual(row.type_label, "Прочее")
        self.assertIsNone(row.employee_name)


class ExpenseSchemaTests(unittest.TestCase):
    def test_create_salary_requires_employee(self):
        with self.assertRaises(Exception):
            AutoserviceExpenseCreate(
                type="salary",
                amount=Decimal("100"),
                expense_date=date(2026, 10, 5),
            )

    def test_create_other_allows_no_employee(self):
        payload = AutoserviceExpenseCreate(
            type="other",
            amount=Decimal("100"),
            expense_date=date(2026, 10, 5),
        )
        self.assertEqual(payload.type, "other")

    def test_update_partial_salary_without_employee_passes_schema(self):
        payload = AutoserviceExpenseUpdate.model_validate({"type": "salary"})
        self.assertEqual(payload.type, "salary")
        self.assertIsNone(payload.employee_id)

    def test_update_salary_with_explicit_null_employee_fails(self):
        with self.assertRaises(Exception):
            AutoserviceExpenseUpdate.model_validate(
                {"type": "salary", "employee_id": None}
            )

    def test_update_other_with_employee_passes_schema(self):
        payload = AutoserviceExpenseUpdate.model_validate(
            {"type": "other", "employee_id": 5}
        )
        self.assertEqual(payload.employee_id, 5)


class ExpensesWorkbookTests(unittest.TestCase):
    def test_workbook_builds_with_expenses(self):
        expenses = [
            _expense(),
            _expense(
                id=2,
                type="other",
                amount=Decimal("500.00"),
                employee_id=None,
                employee=None,
                description=None,
            ),
        ]
        with patch.object(
            expenses_xlsx,
            "list_autoservice_expenses",
            return_value=(expenses, Decimal("15500.00")),
        ):
            data = expenses_xlsx.build_finance_expenses_workbook_bytes(
                None, "ORG1", date(2026, 10, 1), date(2026, 10, 31)
            )
        self.assertGreater(len(data), 1000)

    def test_workbook_empty_period(self):
        with patch.object(
            expenses_xlsx,
            "list_autoservice_expenses",
            return_value=([], Decimal("0.00")),
        ):
            data = expenses_xlsx.build_finance_expenses_workbook_bytes(
                None, "ORG1", date(2026, 10, 1), date(2026, 10, 31)
            )
        self.assertGreater(len(data), 1000)


if __name__ == "__main__":
    unittest.main()
