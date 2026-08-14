import unittest
from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.models.autoservice_payroll_accrual import AutoservicePayrollAccrual
from app.models.autoservice_service_employee import AutoserviceServiceEmployee
from app.services.autoservice_payroll import compute_org_monthly_payroll, month_bounds


class AutoserviceMonthlyPayrollTests(unittest.TestCase):
    def test_month_bounds_august(self):
        start, end = month_bounds(2026, 8)
        self.assertEqual(start, datetime(2026, 8, 1))
        self.assertEqual(end, datetime(2026, 9, 1))

    def test_month_bounds_december(self):
        start, end = month_bounds(2026, 12)
        self.assertEqual(start, datetime(2026, 12, 1))
        self.assertEqual(end, datetime(2027, 1, 1))

    def test_groups_two_employees_from_two_orders(self):
        emp_a = SimpleNamespace(id=1, name="Иванов", is_active=True, organization_id="ORG1")
        emp_b = SimpleNamespace(id=2, name="Петров", is_active=True, organization_id="ORG1")
        emp_idle = SimpleNamespace(id=3, name="Сидоров", is_active=True, organization_id="ORG1")

        accruals = [
            SimpleNamespace(
                employee_id=1,
                order_id=10,
                accrual_type="work_percent",
                amount=Decimal("100.00"),
            ),
            SimpleNamespace(
                employee_id=1,
                order_id=11,
                accrual_type="work_percent",
                amount=Decimal("50.00"),
            ),
            SimpleNamespace(
                employee_id=2,
                order_id=10,
                accrual_type="work_percent",
                amount=Decimal("200.00"),
            ),
            SimpleNamespace(
                employee_id=2,
                order_id=10,
                accrual_type="daily_rate",
                amount=Decimal("1500.00"),
            ),
        ]

        db = MagicMock()

        def query_side_effect(model):
            q = MagicMock()
            q.filter.return_value = q
            q.order_by.return_value = q
            if model is AutoserviceServiceEmployee:
                q.all.return_value = [emp_a, emp_b, emp_idle]
            elif model is AutoservicePayrollAccrual:
                q.all.return_value = accruals
            else:
                q.all.return_value = []
            return q

        db.query.side_effect = query_side_effect

        result = compute_org_monthly_payroll(db, "ORG1", 2026, 8)

        self.assertEqual(result["year"], 2026)
        self.assertEqual(result["month"], 8)
        self.assertEqual(result["total"], Decimal("1850.00"))
        self.assertEqual(len(result["employees"]), 3)

        by_name = {row["name"]: row for row in result["employees"]}
        self.assertEqual(by_name["Иванов"]["completed_orders"], 2)
        self.assertEqual(by_name["Иванов"]["from_works"], Decimal("150.00"))
        self.assertEqual(by_name["Иванов"]["from_daily"], Decimal("0.00"))
        self.assertEqual(by_name["Иванов"]["total"], Decimal("150.00"))

        self.assertEqual(by_name["Петров"]["completed_orders"], 1)
        self.assertEqual(by_name["Петров"]["from_works"], Decimal("200.00"))
        self.assertEqual(by_name["Петров"]["from_daily"], Decimal("1500.00"))
        self.assertEqual(by_name["Петров"]["total"], Decimal("1700.00"))

        self.assertEqual(by_name["Сидоров"]["completed_orders"], 0)
        self.assertEqual(by_name["Сидоров"]["total"], Decimal("0.00"))

    def test_skips_inactive_without_accruals(self):
        inactive = SimpleNamespace(id=4, name="Архив", is_active=False, organization_id="ORG1")
        db = MagicMock()

        def query_side_effect(model):
            q = MagicMock()
            q.filter.return_value = q
            q.order_by.return_value = q
            q.all.return_value = [inactive] if model is AutoserviceServiceEmployee else []
            return q

        db.query.side_effect = query_side_effect
        result = compute_org_monthly_payroll(db, "ORG1", 2026, 8)
        self.assertEqual(result["employees"], [])
        self.assertEqual(result["total"], Decimal("0.00"))
