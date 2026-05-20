"""Tests for warehouse sale detection."""

import unittest
from types import SimpleNamespace

from app.services.stock_out_sales import is_warehouse_sale


class StockOutSalesTests(unittest.TestCase):
    def test_positive_price(self):
        row = SimpleNamespace(sale_price=100, sale_channel=None, avito_order_id=None, reason=None)
        self.assertTrue(is_warehouse_sale(row))

    def test_avito_channel_zero_price(self):
        row = SimpleNamespace(
            sale_price=0,
            sale_channel="avito",
            avito_order_id="123",
            reason="Продано через Авито",
        )
        self.assertTrue(is_warehouse_sale(row))

    def test_writeoff(self):
        row = SimpleNamespace(sale_price=0, sale_channel=None, avito_order_id=None, reason="Брак")
        self.assertFalse(is_warehouse_sale(row))


if __name__ == "__main__":
    unittest.main()
