import sys
import types
import unittest
from decimal import Decimal
from unittest.mock import MagicMock, patch

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

from app.schemas.repair_order import RepairOrderCartImportIn, RepairOrderCartImportItemIn
from app.services.repair_order_cart_import import (
    CART_ITEM_TYPE_NEW,
    CART_ITEM_TYPE_USED,
    append_cart_items_to_repair_order,
    clear_repair_order_cart_links,
    shop_part_is_in_cart,
)
from app.services.repair_order_purchase_import import shop_part_is_imported


class ShopPartImportedFlagTests(unittest.TestCase):
    def test_purchase_new_is_imported(self):
        part = MagicMock(cart_item_type="new", cart_item_id=15)
        self.assertTrue(shop_part_is_imported(part))

    def test_cart_new_is_not_imported(self):
        part = MagicMock(cart_item_type=CART_ITEM_TYPE_NEW, cart_item_id=15)
        self.assertFalse(shop_part_is_imported(part))

    def test_cart_used_is_not_imported(self):
        part = MagicMock(cart_item_type=CART_ITEM_TYPE_USED, cart_item_id=7)
        self.assertFalse(shop_part_is_imported(part))


class ShopPartInCartFlagTests(unittest.TestCase):
    def test_cart_new_found_in_cart(self):
        part = MagicMock(cart_item_type=CART_ITEM_TYPE_NEW, cart_item_id=10)
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = MagicMock(id=10)
        self.assertTrue(shop_part_is_in_cart(db, part))

    def test_cart_new_missing_from_cart(self):
        part = MagicMock(cart_item_type=CART_ITEM_TYPE_NEW, cart_item_id=10)
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        self.assertFalse(shop_part_is_in_cart(db, part))

    def test_purchase_line_not_in_cart(self):
        part = MagicMock(cart_item_type="new", cart_item_id=10)
        db = MagicMock()
        self.assertFalse(shop_part_is_in_cart(db, part))


class AppendCartItemsTests(unittest.TestCase):
    def test_adds_new_and_used_cart_rows(self):
        db = MagicMock()
        new_row = MagicMock(
            id=1,
            brand="MANN",
            partnumber="W712",
            name="Filter",
            quantity=2,
            price=Decimal("500"),
            purchase_price=Decimal("400"),
        )
        used_row = MagicMock(
            id=2,
            brand="BMW",
            partnumber="123",
            product_id=55,
            quantity=1,
            price=Decimal("1000"),
        )
        product = MagicMock(
            brand="BMW",
            article="123",
            internal_code="",
            name="Part",
            price=Decimal("1000"),
        )

        def query_side_effect(model):
            query = MagicMock()
            name = getattr(model, "__name__", "")
            if name == "NewPartsCart":
                query.filter.return_value.all.return_value = [new_row]
            elif name == "UsedPartsCart":
                query.filter.return_value.all.return_value = [used_row]
            elif name == "Product":
                query.filter.return_value.first.return_value = product
            else:
                query.join.return_value.filter.return_value.all.return_value = []
            return query

        db.query.side_effect = query_side_effect
        order = MagicMock(id=3, status="pending", shop_parts=[])
        payload = RepairOrderCartImportIn(items=[
            RepairOrderCartImportItemIn(item_id=1, item_type="new"),
            RepairOrderCartImportItemIn(item_id=2, item_type="used"),
        ])

        with patch("app.services.repair_order_cart_import.RepairOrderShopPart", side_effect=lambda **kwargs: kwargs):
            added = append_cart_items_to_repair_order(
                db,
                order=order,
                org_id="ORG1",
                user=MagicMock(id=5),
                payload=payload,
            )

        self.assertEqual(added, 2)
        self.assertEqual(len(order.shop_parts), 2)

    def test_skips_duplicate_cart_item_in_same_order(self):
        db = MagicMock()
        new_row = MagicMock(
            id=1,
            brand="MANN",
            partnumber="W712",
            name="Фильтр",
            quantity=1,
            price=Decimal("500"),
            purchase_price=None,
        )
        existing_part = MagicMock(cart_item_type=CART_ITEM_TYPE_NEW, cart_item_id=1)
        order = MagicMock(id=3, status="pending", shop_parts=[existing_part])

        def query_side_effect(model):
            query = MagicMock()
            name = getattr(model, "__name__", "")
            if name == "NewPartsCart":
                query.filter.return_value.all.return_value = [new_row]
            else:
                query.join.return_value.filter.return_value.all.return_value = []
            return query

        db.query.side_effect = query_side_effect
        payload = RepairOrderCartImportIn(items=[
            RepairOrderCartImportItemIn(item_id=1, item_type="new"),
        ])

        added = append_cart_items_to_repair_order(
            db,
            order=order,
            org_id="ORG1",
            user=MagicMock(id=5),
            payload=payload,
        )

        self.assertEqual(added, 0)


class ClearCartLinksTests(unittest.TestCase):
    def test_clears_cart_item_fields(self):
        part = MagicMock(cart_item_type=CART_ITEM_TYPE_NEW, cart_item_id=12)
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = [part]

        cleared = clear_repair_order_cart_links(
            db,
            cart_item_type=CART_ITEM_TYPE_NEW,
            cart_item_ids=[12],
        )

        self.assertEqual(cleared, 1)
        self.assertIsNone(part.cart_item_type)
        self.assertIsNone(part.cart_item_id)


if __name__ == "__main__":
    unittest.main()
