"""Unit tests for Avito order line pricing (mirrors frontend avitoOrderDisplay.js)."""

import unittest

from app.services.avito_order_pricing import (
    avito_line_item_qty,
    avito_line_item_total,
    avito_line_item_unit_price,
    unit_price_for_stock_out,
)


class AvitoOrderPricingTests(unittest.TestCase):
    def test_qty_from_count(self):
        self.assertEqual(avito_line_item_qty({"count": 3}), 3)

    def test_qty_from_quantity(self):
        self.assertEqual(avito_line_item_qty({"quantity": 2}), 2)

    def test_qty_default_one(self):
        self.assertEqual(avito_line_item_qty({}), 1)

    def test_total_from_prices_total(self):
        item = {"prices": {"total": 1500}, "count": 2}
        self.assertEqual(avito_line_item_total(item), 1500.0)

    def test_total_from_unit_price_times_qty(self):
        item = {"price": 500, "count": 2}
        self.assertEqual(avito_line_item_total(item), 1000.0)

    def test_total_from_prices_price_times_qty(self):
        item = {"prices": {"price": 300}, "quantity": 4}
        self.assertEqual(avito_line_item_total(item), 1200.0)

    def test_total_zero_when_empty(self):
        self.assertEqual(avito_line_item_total({}), 0.0)

    def test_unit_price_from_total(self):
        item = {"prices": {"total": 900}, "count": 3}
        self.assertEqual(avito_line_item_unit_price(item), 300.0)

    def test_unit_price_for_stock_out_fallback_product(self):
        item = {}
        self.assertEqual(
            unit_price_for_stock_out(item, product_price=250.0),
            250.0,
        )

    def test_unit_price_for_stock_out_prefers_avito(self):
        item = {"prices": {"total": 1000}, "count": 2}
        self.assertEqual(unit_price_for_stock_out(item, product_price=99.0), 500.0)


if __name__ == "__main__":
    unittest.main()
