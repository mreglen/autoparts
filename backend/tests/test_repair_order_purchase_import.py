import sys
import types
import unittest
from decimal import Decimal
from unittest.mock import MagicMock, patch

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

from app.schemas.repair_order import RepairOrderPurchaseImportIn
from app.services.repair_order_cart_import import shop_part_display_name
from app.services.repair_order_purchase_import import (
    append_purchase_items_to_repair_order,
    detach_imported_shop_part_from_repair_order,
    detach_purchase_items_from_other_orders,
    shop_part_is_imported,
)
from app.services import repair_order_cart_import as import_module


class ShopPartDisplayNameTests(unittest.TestCase):
    def test_combines_brand_partnumber_title(self):
        name = shop_part_display_name(
            title="Масляный фильтр",
            brand="MANN",
            partnumber="W712/75",
        )
        self.assertEqual(name, "MANN W712/75 Масляный фильтр")


class DerivePricesTests(unittest.TestCase):
    def test_without_purchase_uses_client_price(self):
        unit, markup = import_module._derive_prices(Decimal("120.00"), None)
        self.assertEqual(unit, Decimal("120.00"))
        self.assertEqual(markup, Decimal("0.00"))


class ShopPartImportedFlagTests(unittest.TestCase):
    def test_detects_imported_part(self):
        part = MagicMock(cart_item_type="new", cart_item_id=15)
        self.assertTrue(shop_part_is_imported(part))

    def test_manual_part_not_imported(self):
        part = MagicMock(cart_item_type=None, cart_item_id=None)
        self.assertFalse(shop_part_is_imported(part))


class AppendPurchaseItemsTests(unittest.TestCase):
    def test_raises_when_items_missing(self):
        db = MagicMock()
        query = db.query.return_value.join.return_value.filter.return_value
        query.all.return_value = []
        order = MagicMock(shop_parts=[])
        payload = RepairOrderPurchaseImportIn(order_type="new", item_ids=[1])

        with self.assertRaises(Exception):
            append_purchase_items_to_repair_order(
                db,
                order=order,
                org_id="ORG1",
                user=MagicMock(id=5, email=None, phone=None),
                payload=payload,
            )

    def test_does_not_detach_when_items_missing(self):
        db = MagicMock()
        query = db.query.return_value.join.return_value.filter.return_value
        query.all.return_value = []
        order = MagicMock(id=2, shop_parts=[])
        payload = RepairOrderPurchaseImportIn(order_type="new", item_ids=[1])

        with self.assertRaises(Exception):
            append_purchase_items_to_repair_order(
                db,
                order=order,
                org_id="ORG1",
                user=MagicMock(id=5, email=None, phone=None),
                payload=payload,
            )
        db.delete.assert_not_called()


class DetachPurchaseItemsTests(unittest.TestCase):
    def test_deletes_matching_parts_from_other_orders_and_reindexes(self):
        stale = MagicMock(order_id=1, position=1)
        leftover = MagicMock(order_id=1, position=2)
        db = MagicMock()
        stale_query = db.query.return_value.join.return_value.filter.return_value
        stale_query.all.return_value = [stale]
        remaining_query = db.query.return_value.filter.return_value.order_by.return_value
        remaining_query.all.return_value = [leftover]

        removed = detach_purchase_items_from_other_orders(
            db,
            target_order_id=2,
            org_id="ORG1",
            order_type="new",
            item_ids=[15],
        )

        self.assertEqual(removed, 1)
        db.delete.assert_called_once_with(stale)
        db.flush.assert_called_once()
        self.assertEqual(leftover.position, 1)

    def test_noop_when_no_stale_parts(self):
        db = MagicMock()
        db.query.return_value.join.return_value.filter.return_value.all.return_value = []

        removed = detach_purchase_items_from_other_orders(
            db,
            target_order_id=2,
            org_id="ORG1",
            order_type="used",
            item_ids=[9],
        )

        self.assertEqual(removed, 0)
        db.delete.assert_not_called()


class DetachImportedShopPartTests(unittest.TestCase):
    def test_releases_reservation_and_deletes_imported_part(self):
        from fastapi import HTTPException

        order = MagicMock(id=2, organization_id="ORG1", status="pending")
        part = MagicMock(
            id=9,
            order_id=2,
            cart_item_type="new",
            cart_item_id=15,
            source="autoservice_stock",
            autoservice_stock_item_id=3,
            qty=1,
        )
        db = MagicMock()
        db.query.return_value.filter.return_value.first.side_effect = [order, part]
        remaining_query = db.query.return_value.filter.return_value.order_by.return_value
        remaining_query.all.return_value = []

        with patch(
            "app.services.repair_order_purchase_import.release_shop_part_reservation",
        ) as release_mock:
            detach_imported_shop_part_from_repair_order(
                db,
                org_id="ORG1",
                order_id=2,
                part_id=9,
            )

        release_mock.assert_called_once_with(db, part)
        db.delete.assert_called_once_with(part)
        db.flush.assert_called_once()

    def test_rejects_non_imported_part(self):
        from fastapi import HTTPException

        order = MagicMock(id=2, organization_id="ORG1", status="pending")
        part = MagicMock(
            id=9,
            order_id=2,
            cart_item_type=None,
            cart_item_id=None,
        )
        db = MagicMock()
        db.query.return_value.filter.return_value.first.side_effect = [order, part]

        with self.assertRaises(HTTPException) as ctx:
            detach_imported_shop_part_from_repair_order(
                db,
                org_id="ORG1",
                order_id=2,
                part_id=9,
            )
        self.assertEqual(ctx.exception.status_code, 400)
        db.delete.assert_not_called()

    def test_rejects_completed_order(self):
        from fastapi import HTTPException

        order = MagicMock(id=2, organization_id="ORG1", status="completed")
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = order

        with self.assertRaises(HTTPException) as ctx:
            detach_imported_shop_part_from_repair_order(
                db,
                org_id="ORG1",
                order_id=2,
                part_id=9,
            )
        self.assertEqual(ctx.exception.status_code, 400)
        db.delete.assert_not_called()

    def test_missing_part_returns_404(self):
        from fastapi import HTTPException

        order = MagicMock(id=2, organization_id="ORG1", status="pending")
        db = MagicMock()
        db.query.return_value.filter.return_value.first.side_effect = [order, None]

        with self.assertRaises(HTTPException) as ctx:
            detach_imported_shop_part_from_repair_order(
                db,
                org_id="ORG1",
                order_id=2,
                part_id=999,
            )
        self.assertEqual(ctx.exception.status_code, 404)


class LookupPurchaseItemRepairOrdersTests(unittest.TestCase):
    def test_maps_item_ids_to_repair_orders(self):
        from app.services.repair_order_purchase_import import lookup_purchase_item_repair_orders

        db = MagicMock()
        db.query.return_value.join.return_value.filter.return_value.all.return_value = [
            (15, 42, "A-100"),
        ]
        links = lookup_purchase_item_repair_orders(
            db,
            org_id="ORG1",
            order_type="new",
            item_ids=[15],
        )
        self.assertEqual(links[15], {"id": 42, "order_number": "A-100"})

    def test_empty_without_org(self):
        from app.services.repair_order_purchase_import import lookup_purchase_item_repair_orders

        self.assertEqual(
            lookup_purchase_item_repair_orders(
                MagicMock(),
                org_id=None,
                order_type="new",
                item_ids=[1],
            ),
            {},
        )


if __name__ == "__main__":
    unittest.main()
