import unittest
from datetime import date, datetime, time
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import app.models  # noqa: F401

from app.models.autoservice_payment import AutoservicePayment
from app.models.inspection_booking import InspectionBooking
from app.models.repair_order import RepairOrder, RepairOrderShopPart, RepairOrderWork
from app.routers import autoservice_planner as planner_router
from app.services.autoservice_client_stats import client_stats_map
from app.services import autoservice_order_economics as economics


class DiscountFactorTests(unittest.TestCase):
    def test_router_factor(self):
        order = SimpleNamespace(discount_percent=Decimal("10"))
        from app.routers.autoservice_repair_orders import _discount_factor

        self.assertEqual(_discount_factor(order), Decimal("0.9"))
        self.assertEqual(
            _discount_factor(SimpleNamespace(discount_percent=None)), Decimal("1")
        )
        self.assertEqual(
            _discount_factor(SimpleNamespace(discount_percent=Decimal("150"))),
            Decimal("0"),
        )

    def test_economics_grand_total_with_discount(self):
        order = SimpleNamespace(
            discount_percent=Decimal("10"),
            works=[
                SimpleNamespace(position=1, id=1, qty=2, unit_price=Decimal("500")),
            ],
            shop_parts=[
                SimpleNamespace(
                    position=1,
                    id=2,
                    qty=1,
                    unit_price=Decimal("1000"),
                    markup_percent=Decimal("20"),
                    client_unit_price_override=None,
                    source="manual",
                ),
            ],
        )
        # works 1000 + shop 1000*1.2(ceil)=1200 → 2200 * 0.9 = 1980
        self.assertEqual(economics._order_grand_total(order), Decimal("1980.00"))

    def test_economics_grand_total_without_discount(self):
        order = SimpleNamespace(
            discount_percent=None,
            works=[SimpleNamespace(position=1, id=1, qty=1, unit_price=Decimal("100"))],
            shop_parts=[],
        )
        self.assertEqual(economics._order_grand_total(order), Decimal("100.00"))


class ClientStatsMapTests(unittest.TestCase):
    def test_stats_batch(self):
        db = MagicMock()
        orders_rows = [
            (1, 10, Decimal("10"), datetime(2026, 8, 1, 10, 0)),
            (2, 10, Decimal("0"), datetime(2026, 8, 3, 9, 0)),
        ]
        works_rows = [(1, 2, Decimal("500")), (2, 1, Decimal("200"))]
        shop_rows = [(1, 1, Decimal("1000"), Decimal("20"), None)]
        paid_rows = [(10, Decimal("1500"))]

        def query_side_effect(*args):
            q = MagicMock()
            if args and args[0] is RepairOrder.id:
                q.filter.return_value.all.return_value = orders_rows
            elif args and args[0] is RepairOrderWork.order_id:
                q.filter.return_value.all.return_value = works_rows
            elif args and args[0] is RepairOrderShopPart.order_id:
                q.filter.return_value.all.return_value = shop_rows
            elif args and args[0] is RepairOrder.client_id:
                q.join.return_value.filter.return_value.group_by.return_value.all.return_value = paid_rows
            return q

        db.query.side_effect = query_side_effect

        stats = client_stats_map(db, "ORG1", [10, 11])

        c10 = stats[10]
        # order1: (1000 + 1200)*0.9 = 1980 ; order2: 200
        self.assertEqual(c10["orders_count"], 2)
        self.assertEqual(c10["orders_total"], Decimal("2180"))
        self.assertEqual(c10["paid_total"], Decimal("1500"))
        self.assertEqual(c10["debt_amount"], Decimal("680"))
        self.assertEqual(c10["last_visit_at"], datetime(2026, 8, 3, 9, 0))

        c11 = stats[11]
        self.assertEqual(c11["orders_count"], 0)
        self.assertEqual(c11["debt_amount"], Decimal("0"))

    def test_empty_ids(self):
        db = MagicMock()
        self.assertEqual(client_stats_map(db, "ORG1", []), {})
        db.query.assert_not_called()


class PlannerConflictsTests(unittest.TestCase):
    def _order(self, oid, start, end=None):
        return SimpleNamespace(
            id=oid,
            order_number=str(oid),
            client_id=1,
            client=SimpleNamespace(name="Иван", phone="+7999"),
            vehicle=None,
            status="pending",
            scheduled_at=start,
            scheduled_end_at=end,
            work_zone_id=5,
            work_zone=SimpleNamespace(id=5, name="Подъёмник"),
        )

    def test_conflicts_lists_overlapping_order(self):
        db = MagicMock()
        order = self._order(7, datetime(2026, 8, 20, 10, 0), datetime(2026, 8, 20, 12, 0))
        booking = SimpleNamespace(
            id=3,
            client_id=None,
            garage_vehicle_id=None,
            name="Пётр",
            phone="+7999",
            vehicle=None,
            status="confirmed",
            preferred_date=date(2026, 8, 20),
            preferred_time=time(11, 0),
            vehicle_make=None,
            vehicle_model=None,
            work_zone_id=5,
            work_zone=SimpleNamespace(id=5, name="Подъёмник"),
            notes=None,
        )
        orders_q = MagicMock()
        orders_q.options.return_value.filter.return_value.order_by.return_value.all.return_value = [order]
        bookings_q = MagicMock()
        bookings_q.options.return_value.filter.return_value.order_by.return_value.all.return_value = [booking]

        queries = [orders_q, bookings_q]
        db.query.side_effect = lambda *a, **k: queries.pop(0)

        with patch.object(
            planner_router, "require_autoservice_permission", return_value="ORG1"
        ):
            items = planner_router.get_planner_conflicts(
                work_zone_id=5,
                start=datetime(2026, 8, 20, 10, 30),
                end=datetime(2026, 8, 20, 11, 30),
                exclude_order_id=None,
                exclude_booking_id=None,
                db=db,
                current_user=MagicMock(),
            )
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0].kind, "order")
        self.assertEqual(items[1].kind, "inspection")


if __name__ == "__main__":
    unittest.main()
