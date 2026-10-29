import sys
import types
import unittest
from datetime import datetime, timedelta
from decimal import Decimal

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker

from app.db.database import Base
from app.models.autoservice_client import AutoserviceClient
from app.models.autoservice_contractor import AutoserviceContractor
from app.models.autoservice_contractor_payout import AutoserviceContractorPayout
from app.models.garage_vehicle import GarageVehicle
from app.models.repair_order import RepairOrder, RepairOrderWork
from app.models.repair_order_work_contractor import RepairOrderWorkContractor
from app.routers.autoservice_repair_orders import _resolve_work_contractors
from app.services.autoservice_contractor_payouts import (
    accrue_order_contractor_payouts,
    clear_order_contractor_payouts,
    compute_contractor_stats,
    order_contractor_cost,
)


@compiles(JSONB, "sqlite")
def _jsonb_as_sqlite_json(element, compiler, **kw):
    return "JSON"


ORG = "ORG1"


def _in(contractor_id: int, amount: str):
    from app.schemas.repair_order import RepairOrderWorkContractorIn

    return RepairOrderWorkContractorIn(contractor_id=contractor_id, amount=Decimal(amount))


class ContractorPayoutTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()
        self.contractor = AutoserviceContractor(
            organization_id=ORG, name="Урал Стартер", is_active=True
        )
        self.other_org_contractor = AutoserviceContractor(
            organization_id="ORG2", name="Чужой", is_active=True
        )
        self.retired = AutoserviceContractor(
            organization_id=ORG, name="Неактивный", is_active=False
        )
        self.db.add_all([self.contractor, self.other_org_contractor, self.retired])
        self.client = AutoserviceClient(
            organization_id=ORG,
            name="Иванов Иван",
            phone="+79000000000",
            source="staff",
            consented_at=datetime.now(),
        )
        self.db.add(self.client)
        self.db.flush()
        self.vehicle = GarageVehicle(
            organization_id=ORG,
            client_id=self.client.id,
            make="LADA",
            model="Vesta",
        )
        self.db.add(self.vehicle)
        self.db.flush()
        self.order = RepairOrder(
            organization_id=ORG,
            client_id=self.client.id,
            vehicle_id=self.vehicle.id,
            scheduled_at=datetime.now(),
            accepted_by_user_id=1,
            status="completed",
        )
        self.db.add(self.order)
        self.db.flush()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _add_work(self, position: int, title: str, assignments: list[tuple[int, str]]):
        work = RepairOrderWork(
            order_id=self.order.id,
            position=position,
            title=title,
            qty=1,
            unit_price=Decimal("1000.00"),
        )
        for contractor_id, amount in assignments:
            work.contractors.append(
                RepairOrderWorkContractor(contractor_id=contractor_id, amount=Decimal(amount))
            )
        self.order.works.append(work)
        self.db.flush()
        return work

    def test_accrual_writes_one_row_per_work_and_contractor(self):
        self._add_work(1, "Ремонт генератора", [(self.contractor.id, "1500.00")])
        self._add_work(2, "Расточка блока", [(self.contractor.id, "0.00")])

        accrue_order_contractor_payouts(self.db, self.order)
        self.db.commit()

        rows = (
            self.db.query(AutoserviceContractorPayout)
            .filter(AutoserviceContractorPayout.order_id == self.order.id)
            .all()
        )
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].amount, Decimal("1500.00"))
        self.assertEqual(rows[0].contractor_id, self.contractor.id)
        self.assertEqual(rows[0].work_title, "Ремонт генератора")
        self.assertEqual(rows[0].accrual_type, "contractor_fixed")

    def test_reaccrual_replaces_previous_rows(self):
        work = self._add_work(1, "Ремонт генератора", [(self.contractor.id, "1500.00")])

        accrue_order_contractor_payouts(self.db, self.order)
        self.db.commit()

        work.contractors.clear()
        work.contractors.append(
            RepairOrderWorkContractor(contractor_id=self.contractor.id, amount=Decimal("900.00"))
        )
        self.db.flush()
        accrue_order_contractor_payouts(self.db, self.order)
        self.db.commit()

        rows = self.db.query(AutoserviceContractorPayout).all()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].amount, Decimal("900.00"))

    def test_clear_removes_all_order_payouts(self):
        self._add_work(1, "Ремонт генератора", [(self.contractor.id, "1500.00")])
        accrue_order_contractor_payouts(self.db, self.order)
        self.db.commit()

        clear_order_contractor_payouts(self.db, self.order.id)
        self.db.commit()
        self.assertEqual(self.db.query(AutoserviceContractorPayout).count(), 0)

    def test_order_cost_sums_assignments(self):
        self._add_work(1, "Ремонт генератора", [(self.contractor.id, "1500.00")])
        self._add_work(2, "Расточка", [(self.contractor.id, "250.50")])
        self.assertEqual(order_contractor_cost(self.db, self.order), Decimal("1750.50"))

    def test_stats_counts_period_only(self):
        self._add_work(1, "Ремонт генератора", [(self.contractor.id, "1500.00")])
        accrue_order_contractor_payouts(
            self.db,
            self.order,
            accrued_at=datetime.now() - timedelta(days=1),
        )
        accrue_past = RepairOrderWorkContractor(
            work_id=self.order.works[0].id,
            contractor_id=self.contractor.id,
            amount=Decimal("100.00"),
        )
        self.db.add(
            AutoserviceContractorPayout(
                organization_id=ORG,
                contractor_id=self.contractor.id,
                order_id=self.order.id,
                work_id=accrue_past.work_id,
                accrual_type="contractor_fixed",
                amount=Decimal("7000.00"),
                accrued_at=datetime.now() - timedelta(days=400),
            )
        )
        self.db.commit()

        stats = compute_contractor_stats(self.db, ORG, self.contractor.id, "month")
        self.assertEqual(stats["total"], Decimal("1500.00"))
        self.assertEqual(stats["orders_count"], 1)

    def test_resolver_rejects_foreign_contractor(self):
        with self.assertRaises(HTTPException) as ctx:
            _resolve_work_contractors(
                self.db,
                ORG,
                [_in(self.other_org_contractor.id, "100")],
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("подрядчики не найдены", ctx.exception.detail.lower())

    def test_resolver_rejects_inactive_contractor(self):
        with self.assertRaises(HTTPException) as ctx:
            _resolve_work_contractors(self.db, ORG, [_in(self.retired.id, "100")])
        self.assertEqual(ctx.exception.status_code, 400)

    def test_resolver_rejects_duplicate_contractor(self):
        with self.assertRaises(HTTPException) as ctx:
            _resolve_work_contractors(
                self.db,
                ORG,
                [_in(self.contractor.id, "100"), _in(self.contractor.id, "200")],
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("дважды", ctx.exception.detail)

    def test_resolver_returns_amounts(self):
        rows = _resolve_work_contractors(self.db, ORG, [_in(self.contractor.id, "1234.5")])
        self.assertEqual(rows[0][0].id, self.contractor.id)
        self.assertEqual(rows[0][1], Decimal("1234.50"))


if __name__ == "__main__":
    unittest.main()
