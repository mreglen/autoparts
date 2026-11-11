import sys
import types
import unittest
from datetime import date, datetime, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base
from app.models.autoservice_client import AutoserviceClient
from app.models.autoservice_contractor import AutoserviceContractor
from app.models.autoservice_warehouse import AutoserviceWarehouseItem
from app.models.autoservice_work import AutoserviceWork
from app.routers.autoservice_clients import _query_autoservice_clients
from app.routers.autoservice_contractors import _query_contractors
from app.routers.autoservice_warehouse import _query_warehouse_items
from app.routers.autoservice_works import _query_autoservice_works
from app.schemas.autoservice_work import AutoserviceWorkView
from app.schemas.page import Page
from app.services.autoservice_payment_service import list_finance_receipts
from app.utils.pagination import build_page


def _page_params(limit=None, offset=0):
    params = MagicMock()
    params.limit = limit
    params.offset = offset
    return params


class QueryHelperPagingTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            bind=self.engine,
            tables=[
                AutoserviceWork.__table__,
                AutoserviceContractor.__table__,
                AutoserviceWarehouseItem.__table__,
                AutoserviceClient.__table__,
            ],
        )
        self.db = sessionmaker(bind=self.engine)()

    def tearDown(self):
        self.db.close()

    def _add_works(self, count, *, inactive_names=()):
        for index in range(1, count + 1):
            name = f"Работа {index:02d}"
            self.db.add(
                AutoserviceWork(
                    organization_id="ORG1",
                    name=name,
                    default_unit_price=Decimal("100.00"),
                    sort_order=1,
                    is_active=name not in inactive_names,
                )
            )
        self.db.add(
            AutoserviceWork(
                organization_id="ORG2",
                name="Работа чужой организации",
                default_unit_price=Decimal("100.00"),
            )
        )
        self.db.commit()

    def test_works_total_ignores_window(self):
        self._add_works(7)
        rows, total = _query_autoservice_works(self.db, "ORG1", None, False, limit=5, offset=0)
        self.assertEqual(total, 7)
        self.assertEqual(len(rows), 5)
        tail, tail_total = _query_autoservice_works(self.db, "ORG1", None, False, limit=5, offset=5)
        self.assertEqual([row.name for row in tail], ["Работа 06", "Работа 07"])
        self.assertEqual(tail_total, 7)

    def test_works_without_limit_match_web_answer(self):
        self._add_works(7, inactive_names=("Работа 03",))
        rows, total = _query_autoservice_works(self.db, "ORG1", None, False)
        self.assertEqual(len(rows), 6)
        self.assertEqual(total, 6)
        self.assertEqual([row.name for row in rows], sorted(row.name for row in rows))

    def test_works_search_survives_paging(self):
        self._add_works(12)
        rows, total = _query_autoservice_works(self.db, "ORG1", "Работа 1", False, limit=2, offset=0)
        self.assertEqual(total, 3)
        self.assertEqual([row.name for row in rows], ["Работа 10", "Работа 11"])

    def test_contractors_total_respects_active_filter(self):
        for index in range(1, 9):
            self.db.add(
                AutoserviceContractor(
                    organization_id="ORG1",
                    name=f"Подрядчик {index:02d}",
                    is_active=index != 3,
                )
            )
        rows, total = _query_contractors(self.db, "ORG1", False, "", limit=5, offset=0)
        self.assertEqual(total, 7)
        self.assertEqual(len(rows), 5)
        self.assertNotIn("Подрядчик 03", [row.name for row in rows])
        all_rows, inactive_total = _query_contractors(self.db, "ORG1", True, "")
        self.assertEqual(inactive_total, 8)
        self.assertEqual(len(all_rows), 8)

    def test_warehouse_items_total_is_not_capped_by_limit(self):
        for index in range(1, 26):
            self.db.add(
                AutoserviceWarehouseItem(
                    organization_id="ORG1",
                    name=f"Товар {index:02d}",
                    brand="Brand",
                    article=f"A{index:03d}",
                    quantity=index % 4,
                    reserved_qty=0,
                    return_reserved_qty=0,
                )
            )
        rows, total = _query_warehouse_items(self.db, "ORG1", "", "", False, False, limit=10, offset=0)
        self.assertEqual(total, 25)
        self.assertEqual(len(rows), 10)
        _, zero_total = _query_warehouse_items(self.db, "ORG1", "", "", False, True)
        self.assertEqual(zero_total, 19)
        zero_rows, _ = _query_warehouse_items(self.db, "ORG1", "", "", False, True, limit=10, offset=10)
        self.assertEqual(len(zero_rows), 9)

    def test_clients_sorting_and_window_stay_together(self):
        now = datetime(2026, 11, 6, 12, 0)
        for index, name in enumerate(("Вера", "Артём", "Борис")):
            self.db.add(
                AutoserviceClient(
                    organization_id="ORG1",
                    name=name,
                    phone=f"+7912000000{index}",
                    status="active",
                    source="staff",
                    consented_at=now - timedelta(days=index),
                )
            )
        self.db.commit()

        default_rows, total = _query_autoservice_clients(self.db, "ORG1", None)
        self.assertEqual(total, 3)
        self.assertEqual([row.name for row in default_rows], ["Вера", "Артём", "Борис"])

        by_name, _ = _query_autoservice_clients(self.db, "ORG1", None, sort_by="name", sort_dir="asc")
        self.assertEqual([row.name for row in by_name], ["Артём", "Борис", "Вера"])

        pages = [
            _query_autoservice_clients(
                self.db, "ORG1", None, limit=2, offset=offset, sort_by="name", sort_dir="asc"
            )[0]
            for offset in (0, 2)
        ]
        self.assertEqual([row.name for row in pages[0] + pages[1]], ["Артём", "Борис", "Вера"])


class BuildPageContractTests(unittest.TestCase):
    def test_page_fields_match_web_list_length(self):
        items = [
            AutoserviceWorkView(
                id=1,
                name="A",
                default_unit_price=Decimal("1.00"),
                sort_order=1,
                is_active=True,
            )
        ]
        payload = build_page(items, 3, _page_params(limit=1, offset=0))
        self.assertEqual(payload["total"], 3)
        self.assertTrue(payload["has_more"])
        self.assertEqual(len(payload["items"]), 1)
        Page[AutoserviceWorkView].model_validate(payload)

    def test_fetched_at_is_naive_moscow_wall_clock(self):
        payload = build_page([], 0, _page_params(limit=50, offset=0))
        self.assertFalse(payload["has_more"])
        parsed = datetime.fromisoformat(payload["fetched_at"])
        self.assertIsNone(parsed.tzinfo)
        self.assertLess(abs(parsed - datetime.now()), timedelta(seconds=60))


class FinanceReceiptsPagingTests(unittest.TestCase):
    def _payments(self):
        order = MagicMock()
        order.client.name = "Ivan Petrov"
        order.order_number = "16"
        rows = []
        for index in range(1, 4):
            rows.append(
                MagicMock(
                    id=100 + index,
                    sequential_number=index,
                    repair_order_id=1,
                    amount=Decimal("100.00"),
                    method="cash",
                    created_at=datetime(2026, 8, index, 12, 0, 0),
                    paid_at=datetime(2026, 8, index, 12, 0, 0),
                    order=order,
                )
            )
        return rows

    def _call(self, **kwargs):
        db = MagicMock()
        query = db.query.return_value
        query.options.return_value = query
        query.join.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.all.return_value = self._payments()
        with patch(
            "app.services.autoservice_payment_service.joinedload", return_value=MagicMock()
        ):
            return list_finance_receipts(
                db,
                org_id="ORG1",
                date_from=date(2026, 8, 1),
                date_to=date(2026, 8, 31),
                **kwargs,
            )

    def test_without_limit_response_never_has_more(self):
        report = self._call()
        self.assertEqual(len(report.items), 3)
        self.assertEqual(report.count, 3)
        self.assertEqual(report.total, 3)
        self.assertFalse(report.has_more)
        self.assertIsNone(report.limit)
        self.assertEqual(report.offset, 0)

    def test_totals_cover_whole_period_not_only_page(self):
        report = self._call(limit=2, offset=0)
        self.assertEqual(len(report.items), 2)
        self.assertEqual(report.total, 3)
        self.assertEqual(report.count, 3)
        self.assertTrue(report.has_more)
        self.assertEqual(report.totals.cash, Decimal("300.00"))
        self.assertEqual(report.total_amount, Decimal("300.00"))

    def test_last_page_reports_no_more(self):
        report = self._call(limit=2, offset=2)
        self.assertEqual([row.id for row in report.items], [103])
        self.assertFalse(report.has_more)


if __name__ == "__main__":
    unittest.main()
