import sys
import types
import unittest
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


def _call(query, **kwargs):
    params = dict(
        scope="active",
        q=None,
        status_filter=None,
        client_id=None,
        date_from=None,
        date_to=None,
        limit=50,
        offset=0,
        db=MagicMock(),
        current_user=MagicMock(),
    )
    params.update(kwargs)
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
        return_value={},
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

        _call(query, scope="all", status_filter="completed")

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
                    date_from=None,
                    date_to=None,
                    limit=50,
                    offset=0,
                    db=MagicMock(),
                    current_user=MagicMock(),
                )
        self.assertEqual(ctx.exception.status_code, 403)

    def test_bad_status_rejected_for_history(self):
        query = _query()
        with self.assertRaises(HTTPException) as ctx:
            _call(query, scope="history", status_filter="pending")
        self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
