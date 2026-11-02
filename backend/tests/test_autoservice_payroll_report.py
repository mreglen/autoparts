import json
import unittest
from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.models.autoservice_payroll_accrual import AutoservicePayrollAccrual
from app.models.autoservice_service_employee import AutoserviceServiceEmployee
from app.models.garage_vehicle import GarageVehicle
from app.models.repair_order import RepairOrder, RepairOrderWork
from app.schemas.autoservice_finance import AutoservicePayrollReportEmployeeRow
from app.services.autoservice_payroll import (
    accrue_order_payroll,
    compute_employee_monthly_payroll,
    compute_org_monthly_payroll,
    month_bounds,
)


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


def _mock_db(employees, accruals, orders=None, vehicles=None, works=None):
    db = MagicMock()
    orders = orders or []
    vehicles = vehicles or [_vehicle(order.id) for order in orders if getattr(order, "vehicle_id", None)]
    works = works or []

    def query_side_effect(model):
        q = MagicMock()
        q.filter.return_value = q
        q.order_by.return_value = q
        q.options.return_value = q
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
                work_id=501,
                accrual_type="work_percent",
                amount=Decimal("100.00"),
                accrued_at=datetime(2026, 10, 31, 19, 55),
            ),
            SimpleNamespace(
                employee_id=1,
                order_id=11,
                work_id=502,
                accrual_type="work_percent",
                amount=Decimal("50.00"),
                accrued_at=datetime(2026, 8, 15, 12, 0),
            ),
            SimpleNamespace(
                employee_id=2,
                order_id=10,
                work_id=501,
                accrual_type="work_percent",
                amount=Decimal("200.00"),
                accrued_at=datetime(2026, 10, 31, 19, 55),
            ),
            SimpleNamespace(
                employee_id=2,
                order_id=10,
                work_id=None,
                accrual_type="daily_rate",
                amount=Decimal("1500.00"),
                accrued_at=datetime(2026, 10, 31, 19, 55),
            ),
        ]

        works = [
            SimpleNamespace(
                id=501,
                order_id=10,
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
                order_id=11,
                title="Диагностика",
                qty=1,
                unit_price=Decimal("500.00"),
                position=1,
                executors=[SimpleNamespace(employee_id=1, percent=Decimal("10.00"))],
            ),
        ]

        orders = [_order(10, "RO-010"), _order(11, "RO-011")]
        db = _mock_db([emp_a, emp_b, emp_idle], accruals, orders, works=works)

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
        self.assertEqual(ivanov_by_order[10]["end_at"], "2026-10-31")
        self.assertEqual(ivanov_by_order[11]["end_at"], "2026-08-15")
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
                accrued_at=datetime(2026, 8, 15, 12, 0),
            ),
            SimpleNamespace(
                employee_id=1,
                order_id=10,
                work_id=None,
                accrual_type="daily_rate",
                amount=Decimal("1500.00"),
                accrued_at=datetime(2026, 8, 15, 12, 0),
            ),
            SimpleNamespace(
                employee_id=1,
                order_id=10,
                work_id=501,
                accrual_type="work_percent",
                amount=Decimal("50.00"),
                accrued_at=datetime(2026, 8, 15, 12, 0),
            ),
        ]
        works = [
            SimpleNamespace(
                id=501,
                order_id=10,
                title="Ремонт",
                qty=1,
                unit_price=Decimal("1500.00"),
                position=1,
                executors=[SimpleNamespace(employee_id=1, percent=Decimal("10.00"))],
            ),
        ]
        db = _mock_db([emp], accruals, [_order(10, "RO-010")], works=works)

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
        db = _mock_db([inactive], [])
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
                order_id=10,
                title="Диагностика",
                qty=1,
                unit_price=Decimal("1500.00"),
                position=1,
                executors=[SimpleNamespace(employee_id=1, percent=Decimal("10.00"))],
            ),
        ]
        db = _mock_db([emp], accruals, [_order(10, "RO-010")], works=works)

        result = compute_employee_monthly_payroll(db, "ORG1", 1, 2026, 8)

        self.assertEqual(result["employee_id"], 1)
        self.assertEqual(result["name"], "Иванов")
        self.assertEqual(result["total"], Decimal("150.00"))
        self.assertEqual(result["completed_orders"], 1)
        self.assertEqual(len(result["orders"]), 1)
        self.assertEqual(result["orders"][0]["works"][0]["title"], "Диагностика")

    def test_accrue_order_payroll_recreates_accruals_with_given_timestamp(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = []
        work = SimpleNamespace(
            id=501,
            position=1,
            title="Ремонт",
            qty=2,
            unit_price=Decimal("1000.00"),
            executors=[
                SimpleNamespace(employee_id=1, percent=Decimal("10.00")),
                SimpleNamespace(employee_id=2, percent=Decimal("20.00")),
            ],
        )
        order = SimpleNamespace(id=10, organization_id="ORG1", works=[work])
        ts = datetime(2026, 8, 15, 12, 0, 0)

        accrue_order_payroll(db, order, accrued_at=ts)

        db.query.return_value.filter.return_value.delete.assert_called_once_with(
            synchronize_session=False
        )
        added = [call.args[0] for call in db.add.call_args_list]
        self.assertEqual(len(added), 2)
        by_employee = {row.employee_id: row for row in added}
        self.assertEqual(by_employee[1].amount, Decimal("200.00"))
        self.assertEqual(by_employee[2].amount, Decimal("400.00"))
        self.assertEqual(by_employee[1].accrued_at, ts)
        self.assertEqual(by_employee[2].accrued_at, ts)
        self.assertEqual(by_employee[1].work_id, 501)
        self.assertEqual(by_employee[1].work_title, "Ремонт")


class OrderAccrualTimestampTests(unittest.TestCase):
    def _ts(self, scheduled_end_at, status_completed_at):
        from app.routers.autoservice_repair_orders import _order_accrual_timestamp

        db = MagicMock()
        order = SimpleNamespace(
            id=10,
            scheduled_end_at=scheduled_end_at,
            status_completed_at=status_completed_at,
        )
        return _order_accrual_timestamp(db, order)

    def test_late_closure_keeps_accrual_in_the_work_month(self):
        self.assertEqual(
            self._ts(datetime(2026, 10, 31, 18, 0), datetime(2026, 11, 2, 9, 8)),
            datetime(2026, 10, 31, 18, 0),
        )

    def test_early_closure_does_not_move_accrual_into_the_future(self):
        self.assertEqual(
            self._ts(datetime(2026, 12, 15, 0, 0), datetime(2026, 11, 2, 9, 8)),
            datetime(2026, 11, 2, 9, 8),
        )

    def test_without_dates_falls_back_to_existing_accruals(self):
        from app.routers.autoservice_repair_orders import _order_accrual_timestamp

        db = MagicMock()
        db.query.return_value.filter.return_value.scalar.return_value = datetime(2026, 9, 1, 12, 0)
        order = SimpleNamespace(id=10, scheduled_end_at=None, status_completed_at=None)
        self.assertEqual(_order_accrual_timestamp(db, order), datetime(2026, 9, 1, 12, 0))


class PayrollReportResponseSchemaTests(unittest.TestCase):
    """Схема ответа молча вырезает необъявленные поля сервиса, поэтому проверяем итоговый JSON."""

    def _payload(self):
        from app.schemas.autoservice_finance import AutoservicePayrollReportResponse

        emp = SimpleNamespace(id=1, name="Иванов", is_active=True, organization_id="ORG1")
        accruals = [
            SimpleNamespace(
                employee_id=1,
                order_id=10,
                work_id=501,
                accrual_type="work_percent",
                amount=Decimal("4000.00"),
                accrued_at=datetime(2026, 10, 31, 19, 55),
            ),
        ]
        works = [
            SimpleNamespace(
                id=501,
                order_id=10,
                title="Ремонт",
                qty=1,
                unit_price=Decimal("40000.00"),
                position=1,
                executors=[SimpleNamespace(employee_id=1, percent=Decimal("10.00"))],
            ),
        ]
        db = _mock_db([emp], accruals, [_order(10, "120")], works=works)
        data = compute_org_monthly_payroll(db, "ORG1", 2026, 10)
        return json.loads(
            AutoservicePayrollReportResponse(
                year=data["year"],
                month=data["month"],
                total=data["total"],
                employees=[AutoservicePayrollReportEmployeeRow.model_validate(row) for row in data["employees"]],
            ).model_dump_json()
        )

    def test_order_end_at_survives_api_serialization(self):
        order_row = self._payload()["employees"][0]["orders"][0]
        self.assertEqual(order_row["order_number"], "120")
        self.assertEqual(order_row["end_at"], "2026-10-31")

    def test_employee_payroll_response_carries_end_at(self):
        from app.schemas.autoservice_finance import AutoserviceMyPayrollOrderRow

        row = AutoserviceMyPayrollOrderRow.model_validate(self._payload()["employees"][0]["orders"][0])
        self.assertEqual(json.loads(row.model_dump_json())["end_at"], "2026-10-31")
