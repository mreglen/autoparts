import sys
import types
import unittest
from decimal import Decimal
from unittest.mock import MagicMock, patch

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

import app.models  # noqa: F401

from fastapi import HTTPException

from app.routers.autoservice_repair_orders import list_repair_orders


def _query(rows=(), total=0):
    q = MagicMock()
    q.filter.return_value = q
    q.order_by.return_value = q
    q.offset.return_value = q
    q.limit.return_value = q
    q.all.return_value = list(rows)
    q.count.return_value = total
    return q


def _call(query, paid=None, grand_totals=None, **kwargs):
    params = dict(
        scope="active",
        q=None,
        status_filter=None,
        client_id=None,
        work_zone_id=None,
        payment_filter=None,
        date_from=None,
        date_to=None,
        limit=50,
        offset=0,
        sort_by="scheduled_at",
        sort_dir="desc",
        db=MagicMock(),
        current_user=MagicMock(),
    )
    params.update(kwargs)
    paid_map = paid or {}

    def _grand_total(row):
        return Decimal(grand_totals[row.id]) if grand_totals else Decimal("0.00")

    with patch(
        "app.routers.autoservice_repair_orders.require_orders_access",
        return_value=("ORG1", "full"),
    ), patch(
        "app.routers.autoservice_repair_orders._order_query",
        return_value=query,
    ), patch(
        "app.routers.autoservice_repair_orders._apply_search_filter",
        side_effect=lambda q, _term: q,
    ), patch(
        "app.routers.autoservice_repair_orders.batch_paid_amounts",
        return_value=paid_map,
    ), patch(
        "app.routers.autoservice_repair_orders._order_grand_total",
        side_effect=_grand_total,
    ), patch(
        "app.routers.autoservice_repair_orders._to_staff_view",
        side_effect=lambda _db, row, **kwargs: row,
    ), patch(
        "app.routers.autoservice_repair_orders.RepairOrderListPage",
        side_effect=lambda **kw: types.SimpleNamespace(**kw),
    ):
        return list_repair_orders(**params)


class ListRepairOrdersPaginationTests(unittest.TestCase):
    def test_returns_page_envelope(self):
        query = _query(rows=[], total=137)

        result = _call(query, limit=50, offset=100)

        self.assertEqual(result.total, 137)
        self.assertTrue(result.has_more)
        query.offset.assert_called_once_with(100)
        query.limit.assert_called_once_with(50)

    def test_has_more_false_on_last_page(self):
        rows = [MagicMock(id=i) for i in range(50)]
        query = _query(rows=rows, total=40)

        result = _call(query, limit=50, offset=0)

        self.assertEqual(result.total, 40)
        self.assertEqual(len(result.items), 50)
        self.assertFalse(result.has_more)

    def test_status_filter_applied_for_all_scope(self):
        query = _query(rows=[], total=0)

        _call(query, scope="all", status_filter=["completed"])

        self.assertGreater(query.filter.call_count, 1)

    def test_review_scope_forbidden_for_own_level(self):
        query = _query()
        with patch(
            "app.routers.autoservice_repair_orders.require_orders_access",
            return_value=("ORG1", "own"),
        ), patch(
            "app.routers.autoservice_repair_orders._order_query",
            return_value=query,
        ):
            with self.assertRaises(HTTPException) as ctx:
                list_repair_orders(
                    scope="review",
                    q=None,
                    status_filter=None,
                    client_id=None,
                    work_zone_id=None,
                    payment_filter=None,
                    date_from=None,
                    date_to=None,
                    limit=50,
                    offset=0,
                    sort_by="scheduled_at",
                    sort_dir="desc",
                    db=MagicMock(),
                    current_user=MagicMock(),
                )
        self.assertEqual(ctx.exception.status_code, 403)

    def test_bad_status_rejected_for_history(self):
        query = _query()
        with self.assertRaises(HTTPException) as ctx:
            _call(query, scope="history", status_filter=["pending"])
        self.assertEqual(ctx.exception.status_code, 400)


class ListRepairOrdersPaymentFilterTests(unittest.TestCase):
    # 1 — без оплат, 2 — внесли часть, 3 — долг закрыт, 4 — заказ на 0 ₽
    ORDERS = [MagicMock(id=1), MagicMock(id=2), MagicMock(id=3), MagicMock(id=4)]
    TOTALS = {1: "1000.00", 2: "1000.00", 3: "1000.00", 4: "0.00"}
    PAID = {2: Decimal("400.00"), 3: Decimal("1000.00"), 4: Decimal("0.00")}

    def _payment_call(self, **kwargs):
        query = _query(rows=self.ORDERS)
        result = _call(
            query,
            paid=self.PAID,
            grand_totals=self.TOTALS,
            payment_filter=kwargs.pop("payment"),
            **kwargs,
        )
        return query, result

    def test_unpaid_only_keeps_orders_without_payments(self):
        _, result = self._payment_call(payment=["unpaid"])

        self.assertEqual([row.id for row in result.items], [1])
        self.assertEqual(result.total, 1)
        self.assertFalse(result.has_more)

    def test_page_slice_applies_after_payment_filtering(self):
        _, result = self._payment_call(payment=["unpaid", "partial"], offset=1, limit=1)

        self.assertEqual([row.id for row in result.items], [2])
        self.assertEqual(result.total, 2)

    def test_zero_total_order_counts_as_paid(self):
        _, result = self._payment_call(payment=["paid"])

        self.assertEqual([row.id for row in result.items], [3, 4])

    def test_sql_pagination_not_used_when_payment_filter_active(self):
        query, _ = self._payment_call(payment=["unpaid"])

        query.offset.assert_not_called()
        query.limit.assert_not_called()

    def test_bad_payment_status_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            self._payment_call(payment=["debt"])

        self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
