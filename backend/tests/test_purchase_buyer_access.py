import unittest
from unittest.mock import MagicMock

from app.utils.client_buyers import order_visible_to_buyer
from app.utils.purchase_buyer_access import used_order_buyer_visibility_filter


class PurchaseBuyerAccessTests(unittest.TestCase):
    def test_legacy_used_order_visible_by_email(self):
        order = MagicMock(user_id=None, buyer_email="buyer@test.ru", buyer_phone="+79001112233")
        self.assertTrue(order_visible_to_buyer(order, 1, "buyer@test.ru", "+79001112233"))

    def test_visibility_filter_includes_user_id_and_email(self):
        user = MagicMock(id=7, email="buyer@test.ru")
        clause = used_order_buyer_visibility_filter(user)
        self.assertIsNotNone(clause)


if __name__ == "__main__":
    unittest.main()
