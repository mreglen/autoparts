import unittest
from datetime import datetime
from types import SimpleNamespace

from app.routers.carts import _merge_new_parts_max, _new_parts_cart_item_response


class NewPartsCartLimitTests(unittest.TestCase):
    def test_latest_limit_replaces_historical_maximum(self):
        self.assertEqual(_merge_new_parts_max(5, 2, 1), 2)

    def test_limit_never_drops_below_cart_quantity(self):
        self.assertEqual(_merge_new_parts_max(5, 1, 2), 2)

    def test_single_available_item_stays_single(self):
        self.assertEqual(_merge_new_parts_max(1, 1, 1), 1)

    def test_missing_live_limit_keeps_existing_limit(self):
        self.assertEqual(_merge_new_parts_max(3, None, 1), 3)

    def test_cart_response_marks_preferred_warehouse(self):
        item = SimpleNamespace(
            id=1,
            brand="MANN",
            partnumber="W712",
            name="Фильтр",
            delivery=None,
            delivery_start=datetime(2026, 1, 1, 10, 0),
            delivery_end=datetime(2026, 1, 1, 18, 0),
            quantity=1,
            max_quantity=1,
            price=100,
            purchase_price=None,
            supplier_unit_price=90,
            stock_id="preferred",
            seller="Rossko",
            created_at=datetime(2026, 1, 1),
            basket_id=1,
        )

        response = _new_parts_cart_item_response(
            item,
            {"preferred": "Склад"},
            frozenset({"preferred"}),
        )

        self.assertTrue(response.preferred_warehouse)
        self.assertEqual(response.warehouse_name, "Склад")
        self.assertTrue(response.available)


if __name__ == "__main__":
    unittest.main()
