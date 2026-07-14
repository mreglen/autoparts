import unittest
from unittest.mock import MagicMock, patch

from app.services.push_notifications import (
    get_sales_order_recipient_user_ids,
    get_sales_returns_recipient_user_ids,
    user_has_sales_orders_access,
    user_has_sales_returns_access,
)


class PushNotificationsRecipientsTests(unittest.TestCase):
    def test_seller_has_orders_and_returns_access(self):
        db = MagicMock()
        user = MagicMock()
        user.is_admin = False
        user.is_seller = True
        user.is_employee = False
        self.assertTrue(user_has_sales_orders_access(db, user))
        self.assertTrue(user_has_sales_returns_access(db, user))

    def test_recipient_helpers_filter_by_permission(self):
        db = MagicMock()
        seller = MagicMock(id=1, organization_id="org1")
        employee_orders = MagicMock(id=2, organization_id="org1")
        employee_returns = MagicMock(id=3, organization_id="org1")
        db.query.return_value.filter.return_value.all.return_value = [
            seller,
            employee_orders,
            employee_returns,
        ]

        def orders_access(_db, user):
            return user.id in (1, 2)

        def returns_access(_db, user):
            return user.id in (1, 3)

        with patch(
            "app.services.push_notifications.user_has_sales_orders_access",
            side_effect=orders_access,
        ), patch(
            "app.services.push_notifications.user_has_sales_returns_access",
            side_effect=returns_access,
        ):
            self.assertEqual(get_sales_order_recipient_user_ids(db, "org1"), [1, 2])
            self.assertEqual(get_sales_returns_recipient_user_ids(db, "org1"), [1, 3])

    def test_empty_org_returns_no_recipients(self):
        db = MagicMock()
        self.assertEqual(get_sales_order_recipient_user_ids(db, None), [])
        self.assertEqual(get_sales_returns_recipient_user_ids(db, None), [])


if __name__ == "__main__":
    unittest.main()
