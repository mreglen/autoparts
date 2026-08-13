import sys
import types
import unittest
from decimal import Decimal
from types import SimpleNamespace

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

from app.routers.autoservice_repair_orders import _effective_shop_unit_price
from app.services.new_parts_order_fulfillment import cart_item_checkout_price


class NewPartsCheckoutPriceTests(unittest.TestCase):
    def test_legacy_client_markup_never_changes_checkout_price(self):
        item = SimpleNamespace(price=Decimal("128.40"), purchase_price=Decimal("107.00"))
        self.assertEqual(cart_item_checkout_price(item), 107.0)

    def test_current_cart_price_is_authoritative(self):
        item = SimpleNamespace(price=Decimal("107.00"), purchase_price=None)
        self.assertEqual(cart_item_checkout_price(item), 107.0)


class RepairOrderClientPriceTests(unittest.TestCase):
    def test_uses_override_when_present(self):
        part = SimpleNamespace(
            unit_price=Decimal("100.00"),
            markup_percent=Decimal("20.00"),
            client_unit_price_override=Decimal("155.50"),
            source="manual",
        )
        self.assertEqual(_effective_shop_unit_price(part), Decimal("155.50"))

    def test_clear_override_restores_percentage_and_rossko_floor(self):
        part = SimpleNamespace(
            unit_price=Decimal("100.99"),
            markup_percent=Decimal("7.00"),
            client_unit_price_override=None,
            source="rossko",
        )
        self.assertEqual(_effective_shop_unit_price(part), Decimal("108.00"))


if __name__ == "__main__":
    unittest.main()
