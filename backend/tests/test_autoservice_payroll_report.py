import unittest
from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.models.autoservice_payroll_accrual import AutoservicePayrollAccrual
from app.models.autoservice_service_employee import AutoserviceServiceEmployee
from app.models.garage_vehicle import GarageVehicle
from app.models.repair_order import RepairOrder, RepairOrderWork
from app.services.autoservice_payroll import compute_employee_monthly_payroll, compute_org_monthly_payroll, month_bounds


def _vehicle(order_id: int):
    return SimpleNamespace(
        id=100 + order_id,
        make="Toyota",
        model="Camry",
        year=2020,
        vin=f"VIN{order_id:05d}",
        plate=f"A{order_id:03d}BC",
    )


def _order(order_id: int, order_number: str):
    return SimpleNamespace(
        id=order_id,
        order_number=order_number,
        vehicle_id=100 + order_id,
    )


class AutoserviceMonthlyPayrollTests(unittest.TestCase):
    def _mock_db(self, employees, accruals, orders=None, vehicles=None, works=None):
        db = MagicMock()
        orders = orders or []
        vehicles = vehicles or [_vehicle(order.id) for order in orders if getattr(order, "vehicle_id", None)]
        works = works or []

        def query_side_effect(model):
            q = MagicMock()
            q.filter.return_value = q
            q.order_by.return_value = q
            if model is AutoserviceServiceEmployee:
                q.all.return_value = employees
                q.first.return_value = employees[0] if employees else None
            elif model is AutoservicePayrollAccrual:
                q.all.return_value = accruals
            elif model is RepairOrder:
                q.all.return_value = orders
            elif model is GarageVehicle:
                q.all.return_value = vehicles
            elif model is RepairOrderWork:
                q.all.return_value = works
            else:
                q.all.return_value = []
            return q

        db.query.side_effect = query_side_effect
        return db

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
                work_id=501,
                accrual_type="work_percent",
                amount=Decimal("100.00"),
            ),
            SimpleNamespace(
                employee_id=1,
                order_id=11,
                work_id=502,
                accrual_type="work_percent",
                amount=Decimal("50.00"),
            ),
            SimpleNamespace(
                employee_id=2,
                order_id=10,
                work_id=501,
                accrual_type="work_percent",
                amount=Decimal("200.00"),
            ),
            SimpleNamespace(
                employee_id=2,
                order_id=10,
                work_id=None,
                accrual_type="daily_rate",
                amount=Decimal("1500.00"),
            ),
        ]

        works = [
            SimpleNamespace(
                id=501,
                title="Замена масла",
                qty=1,
                unit_price=Decimal("1000.00"),
                position=1,
                executors=[
                    SimpleNamespace(employee_id=1, percent=Decimal("10.00")),
                    SimpleNamespace(employee_id=2, percent=Decimal("20.00")),
                ],
            ),
            SimpleNamespace(
                id=502,
                title="Диагностика",
                qty=1,
                unit_price=Decimal("500.00"),
                position=1,
                executors=[SimpleNamespace(employee_id=1, percent=Decimal("10.00"))],
            ),
        ]

        orders = [_order(10, "RO-010"), _order(11, "RO-011")]
        db = self._mock_db([emp_a, emp_b, emp_idle], accruals, orders, works=works)

        result = compute_org_monthly_payroll(db, "ORG1", 2026, 8)

        self.assertEqual(result["year"], 2026)
        self.assertEqual(result["month"], 8)
        self.assertEqual(result["total"], Decimal("1850.00"))
        self.assertEqual(len(result["employees"]), 3)

        by_name = {row["name"]: row for row in result["employees"]}
        ivanov = by_name["Иванов"]
        self.assertEqual(ivanov["completed_orders"], 2)
        self.assertEqual(ivanov["total"], Decimal("150.00"))
        self.assertEqual(len(ivanov["orders"]), 2)
        ivanov_by_order = {o["order_id"]: o for o in ivanov["orders"]}
        self.assertEqual(ivanov_by_order[10]["amount"], Decimal("100.00"))
        self.assertEqual(ivanov_by_order[10]["order_number"], "RO-010")
        self.assertEqual(ivanov_by_order[10]["vehicle"]["make"], "Toyota")
        self.assertEqual(len(ivanov_by_order[10]["works"]), 1)
        self.assertEqual(ivanov_by_order[10]["works"][0]["title"], "Замена масла")
        self.assertEqual(ivanov_by_order[10]["works"][0]["percent"], Decimal("10.00"))
        self.assertEqual(ivanov_by_order[11]["amount"], Decimal("50.00"))

        petrov = by_name["Петров"]
        self.assertEqual(petrov["completed_orders"], 1)
        self.assertEqual(petrov["total"], Decimal("1700.00"))
        self.assertEqual(len(petrov["orders"]), 1)
        self.assertEqual(petrov["orders"][0]["order_id"], 10)
        self.assertEqual(petrov["orders"][0]["amount"], Decimal("1700.00"))
        self.assertEqual(len(petrov["orders"][0]["works"]), 2)
        petrov_work_titles = [item["title"] for item in petrov["orders"][0]["works"]]
        self.assertIn("Замена масла", petrov_work_titles)
        self.assertIn("Сменная ставка", petrov_work_titles)
        self.assertEqual(petrov["orders"][0]["vehicle"]["plate"], "A010BC")

        sidorov = by_name["Сидоров"]
        self.assertEqual(sidorov["completed_orders"], 0)
        self.assertEqual(sidorov["total"], Decimal("0.00"))
        self.assertEqual(sidorov["orders"], [])

    def test_merges_multiple_accruals_for_same_order(self):
        emp = SimpleNamespace(id=1, name="Иванов", is_active=True, organization_id="ORG1")
        accruals = [
            SimpleNamespace(
                employee_id=1,
                order_id=10,
                work_id=501,
                accrual_type="work_percent",
                amount=Decimal("100.00"),
            ),
            SimpleNamespace(
                employee_id=1,
                order_id=10,
                work_id=None,
                accrual_type="daily_rate",
                amount=Decimal("1500.00"),
            ),
            SimpleNamespace(
                employee_id=1,
                order_id=10,
                work_id=501,
                accrual_type="work_percent",
                amount=Decimal("50.00"),
            ),
        ]
        works = [
            SimpleNamespace(
                id=501,
                title="Ремонт",
                qty=1,
                unit_price=Decimal("1500.00"),
                position=1,
                executors=[SimpleNamespace(employee_id=1, percent=Decimal("10.00"))],
            ),
        ]
        db = self._mock_db([emp], accruals, [_order(10, "RO-010")], works=works)

        result = compute_org_monthly_payroll(db, "ORG1", 2026, 8)

        self.assertEqual(result["total"], Decimal("1650.00"))
        row = result["employees"][0]
        self.assertEqual(row["completed_orders"], 1)
        self.assertEqual(row["total"], Decimal("1650.00"))
        self.assertEqual(len(row["orders"]), 1)
        self.assertEqual(row["orders"][0]["amount"], Decimal("1650.00"))
        self.assertEqual(len(row["orders"][0]["works"]), 3)

    def test_skips_inactive_without_accruals(self):
        inactive = SimpleNamespace(id=4, name="Архив", is_active=False, organization_id="ORG1")
        db = self._mock_db([inactive], [])
        result = compute_org_monthly_payroll(db, "ORG1", 2026, 8)
        self.assertEqual(result["employees"], [])
        self.assertEqual(result["total"], Decimal("0.00"))

    def test_compute_employee_monthly_payroll_returns_single_employee(self):
        emp = SimpleNamespace(
            id=1,
            name="Иванов",
            is_active=True,
            organization_id="ORG1",
            position="Механик",
            salary_type="percent_work",
            salary_amount=Decimal("0.00"),
            work_percent=Decimal("50.00"),
        )
        accruals = [
            SimpleNamespace(
                employee_id=1,
                order_id=10,
                work_id=501,
                accrual_type="work_percent",
                amount=Decimal("150.00"),
                accrued_at=datetime(2026, 8, 15),
            ),
        ]
        works = [
            SimpleNamespace(
                id=501,
                title="Диагностика",
                qty=1,
                unit_price=Decimal("1500.00"),
                position=1,
                executors=[SimpleNamespace(employee_id=1, percent=Decimal("10.00"))],
            ),
        ]
        db = self._mock_db([emp], accruals, [_order(10, "RO-010")], works=works)

        result = compute_employee_monthly_payroll(db, "ORG1", 1, 2026, 8)

        self.assertEqual(result["employee_id"], 1)
        self.assertEqual(result["name"], "Иванов")
        self.assertEqual(result["total"], Decimal("150.00"))
        self.assertEqual(result["completed_orders"], 1)
        self.assertEqual(len(result["orders"]), 1)
        self.assertEqual(result["orders"][0]["works"][0]["title"], "Диагностика")
