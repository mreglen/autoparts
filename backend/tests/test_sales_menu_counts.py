import unittest
from unittest.mock import MagicMock, patch

from app.services.sales_menu_counts_service import (
    get_sales_menu_badge_counts,
    user_has_sales_menu_access,
)


class SalesMenuCountsServiceTests(unittest.TestCase):
    def test_user_has_sales_menu_access_orders_or_returns(self):
        db = MagicMock()
        user = MagicMock()

        with patch(
            "app.services.sales_menu_counts_service.user_has_sales_orders_access",
            return_value=False,
        ), patch(
            "app.services.sales_menu_counts_service.user_has_sales_returns_access",
            return_value=True,
        ):
            self.assertTrue(user_has_sales_menu_access(db, user))

        with patch(
            "app.services.sales_menu_counts_service.user_has_sales_orders_access",
            return_value=False,
        ), patch(
            "app.services.sales_menu_counts_service.user_has_sales_returns_access",
            return_value=False,
        ):
            self.assertFalse(user_has_sales_menu_access(db, user))

    def test_get_sales_menu_badge_counts_sums_visible_subitems(self):
        db = MagicMock()
        user = MagicMock()
        user.organization_id = "org1"

        with patch(
            "app.services.sales_menu_counts_service.user_has_sales_orders_access",
            return_value=True,
        ), patch(
            "app.services.sales_menu_counts_service.user_has_sales_returns_access",
            return_value=True,
        ), patch(
            "app.services.sales_menu_counts_service._count_pending_orders",
            return_value=3,
        ), patch(
            "app.services.sales_menu_counts_service._count_requested_returns",
            return_value=2,
        ):
            counts = get_sales_menu_badge_counts(db, user)

        self.assertEqual(counts, {"orders": 3, "returns": 2, "sales": 5})

    def test_get_sales_menu_badge_counts_respects_permissions(self):
        db = MagicMock()
        user = MagicMock()
        user.organization_id = "org1"

        with patch(
            "app.services.sales_menu_counts_service.user_has_sales_orders_access",
            return_value=True,
        ), patch(
            "app.services.sales_menu_counts_service.user_has_sales_returns_access",
            return_value=False,
        ), patch(
            "app.services.sales_menu_counts_service._count_pending_orders",
            return_value=4,
        ) as mock_orders, patch(
            "app.services.sales_menu_counts_service._count_requested_returns",
            return_value=9,
        ) as mock_returns:
            counts = get_sales_menu_badge_counts(db, user)

        mock_orders.assert_called_once_with(db, "org1")
        mock_returns.assert_not_called()
        self.assertEqual(counts, {"orders": 4, "returns": 0, "sales": 4})

    def test_get_sales_menu_badge_counts_no_org(self):
        db = MagicMock()
        user = MagicMock()
        user.organization_id = None

        with patch(
            "app.services.sales_menu_counts_service.user_has_sales_orders_access",
            return_value=True,
        ), patch(
            "app.services.sales_menu_counts_service.user_has_sales_returns_access",
            return_value=True,
        ):
            counts = get_sales_menu_badge_counts(db, user)

        self.assertEqual(counts, {"orders": 0, "returns": 0, "sales": 0})


if __name__ == "__main__":
    unittest.main()
