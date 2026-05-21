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
            source_kind=None,
        )
        self.assertTrue(is_warehouse_sale(row))

    def test_avito_source_kind_zero_price(self):
        row = SimpleNamespace(
            sale_price=0,
            sale_channel=None,
            avito_order_id=None,
            reason=None,
            source_kind="avito",
        )
        self.assertTrue(is_warehouse_sale(row))

    def test_writeoff(self):
        row = SimpleNamespace(
            sale_price=0,
            sale_channel=None,
            avito_order_id=None,
            reason="Брак",
            source_kind="writeoff",
        )
        self.assertFalse(is_warehouse_sale(row))

    def test_marketplace_used_source_kind(self):
        row = SimpleNamespace(
            sale_price=500,
            sale_channel="marketplace_used",
            avito_order_id=None,
            reason="Продажа через маркетплейс Б/У",
            source_kind="marketplace_used",
            garage_used_order_item_id=42,
        )
        self.assertTrue(is_warehouse_sale(row))

    def test_marketplace_used_order_item_link_only(self):
        row = SimpleNamespace(
            sale_price=0,
            sale_channel=None,
            avito_order_id=None,
            reason=None,
            source_kind=None,
            garage_used_order_item_id=7,
        )
        self.assertTrue(is_warehouse_sale(row))


if __name__ == "__main__":
    unittest.main()
