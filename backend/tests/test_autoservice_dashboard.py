import sys
import types
import unittest
from decimal import Decimal
from unittest.mock import MagicMock, patch

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

import app.models  # noqa: F401

from app.routers.autoservice_dashboard import get_autoservice_dashboard_summary

MOD = "app.routers.autoservice_dashboard"


def _user(is_admin=False, is_director=False, is_seller=False, is_employee=True):
    user = MagicMock()
    user.id = 5
    user.is_admin = is_admin
    user.is_director = is_director
    user.is_seller = is_seller
    user.is_employee = is_employee
    return user


def _db():
    db = MagicMock()
    q = MagicMock()
    q.filter.return_value = q
    q.options.return_value = q
    q.order_by.return_value = q
    q.count.return_value = 0
    q.all.return_value = []
    q.scalar.return_value = Decimal("0")
    db.query.return_value = q
    return db


def _has_perm(codes):
    def _check(db, user, code):
        if user.is_admin or user.is_director or user.is_seller:
            return True
        return user.is_employee and code in codes
    return _check


def _call(level, codes, user=None, stats=None, payroll=None):
    db = _db()
    with patch(f"{MOD}.require_autoservice_staff", return_value="ORG1"), patch(
        f"{MOD}.orders_access_level", return_value=level
    ), patch(
        f"{MOD}.has_autoservice_permission", side_effect=_has_perm(codes)
    ), patch(
        f"{MOD}.client_stats_map", return_value=stats or {}
    ), patch(
        f"{MOD}._own_orders_visibility_clause", return_value=True
    ), patch(
        f"{MOD}._today_items", return_value=[]
    ), patch(
        f"{MOD}.user_is_service_executor", return_value=True
    ), patch(
        f"{MOD}.service_employee_id_for_user", return_value=7
    ), patch(
        f"{MOD}.compute_employee_monthly_payroll", return_value=payroll
    ):
        return get_autoservice_dashboard_summary(
            db=db, current_user=user or _user()
        )


class DashboardSummaryTests(unittest.TestCase):
    def test_own_level_gets_no_review_count(self):
        result = _call("own", codes={"autoservice.orders.own"})

        self.assertEqual(result.level, "own")
        self.assertEqual(result.active_orders, 0)
        self.assertIsNone(result.review_orders)

    def test_debt_sums_only_positive_buckets(self):
        stats = {
            1: {"debt_amount": Decimal("100.00")},
            2: {"debt_amount": Decimal("0.00")},
            3: {"debt_amount": Decimal("250.50")},
        }
        result = _call(
            "full",
            codes={"autoservice.clients"},
            stats=stats,
            user=_user(is_director=True),
        )

        self.assertEqual(result.debt_total, Decimal("350.50"))
        self.assertEqual(result.debtors_count, 2)

    def test_director_gets_no_payroll_block(self):
        result = _call(
            "full",
            codes=set(),
            user=_user(is_director=True),
            payroll={"total": Decimal("5000"), "completed_orders": 3},
        )

        self.assertIsNone(result.payroll_month)

    def test_executor_gets_payroll_month(self):
        result = _call(
            "own",
            codes={"autoservice.orders.own"},
            payroll={"total": Decimal("4200.00"), "completed_orders": 4},
        )

        self.assertIsNotNone(result.payroll_month)
        self.assertEqual(result.payroll_month.total, Decimal("4200.00"))
        self.assertEqual(result.payroll_month.completed_orders, 4)


if __name__ == "__main__":
    unittest.main()
