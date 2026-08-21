import sys
import types
import unittest
from unittest.mock import MagicMock, patch

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

import app.models  # noqa: F401
import app.models.autoservice_client  # noqa: F401
import app.models.autoservice_payment  # noqa: F401
import app.models.autoservice_service_employee  # noqa: F401
import app.models.autoservice_work  # noqa: F401
import app.models.autoservice_work_zone  # noqa: F401
import app.models.garage_vehicle  # noqa: F401
import app.models.repair_order  # noqa: F401

from fastapi import HTTPException

from app.models.autoservice_warehouse import (
    AutoserviceWarehouseExpense,
    AutoserviceWarehouseItem,
    AutoserviceWarehouseReceipt,
    AutoserviceWarehouseReceiptDoc,
    AutoserviceWarehouseReturnRequest,
)
from app.models.product import Product
from app.models.repair_order import RepairOrderShopPart
from app.services.autoservice_warehouse_service import delete_receipt_document


def _line(*, line_id=20, item=None, quantity=4, cart_item_type="manual", cart_item_id=None):
    receipt = MagicMock()
    receipt.id = line_id
    receipt.item_id = item.id if item else None
    receipt.item = item
    receipt.quantity = quantity
    receipt.returned_qty = 0
    receipt.return_reserved_qty = 0
    receipt.cart_item_type = cart_item_type
    receipt.cart_item_id = cart_item_id
    return receipt


def _item(*, item_id=10, quantity=4, reserved=0):
    item = MagicMock()
    item.id = item_id
    item.organization_id = "ORG1"
    item.quantity = quantity
    item.reserved_qty = reserved
    item.return_reserved_qty = 0
    return item


class DeleteReceiptDocumentTests(unittest.TestCase):
    def _db(self, *, doc, item=None, has_return=None, shop_parts=None, leftover_parts=None, product=None):
        db = MagicMock()
        doc_query = MagicMock()
        doc_query.options.return_value.filter.return_value.first.return_value = doc
        return_query = MagicMock()
        return_query.filter.return_value.first.return_value = has_return
        item_query = MagicMock()
        item_query.filter.return_value.with_for_update.return_value.all.return_value = (
            [item] if item else []
        )
        shop_query = MagicMock()
        leftover_query = MagicMock()
        shop_query.filter.return_value.all.return_value = shop_parts or []
        leftover_query.filter.return_value.all.return_value = leftover_parts or []
        product_query = MagicMock()
        product_query.filter.return_value.first.return_value = product
        remaining_receipt_query = MagicMock()
        remaining_receipt_query.filter.return_value.first.return_value = None
        remaining_expense_query = MagicMock()
        remaining_expense_query.filter.return_value.first.return_value = None

        def query_for(model):
            if model is AutoserviceWarehouseReceiptDoc:
                return doc_query
            if model is AutoserviceWarehouseReturnRequest:
                return return_query
            if model is AutoserviceWarehouseItem:
                return item_query
            if model is RepairOrderShopPart:
                if shop_query.filter.called:
                    return leftover_query
                return shop_query
            if model is Product:
                return product_query
            if model is AutoserviceWarehouseReceipt:
                return remaining_receipt_query
            if model is AutoserviceWarehouseExpense:
                return remaining_expense_query
            return MagicMock()

        db.query.side_effect = query_for
        return db, shop_query, leftover_query

    def test_deletes_receipt_and_empty_stock_item(self):
        item = _item()
        line = _line(item=item)
        doc = MagicMock()
        doc.id = 7
        doc.organization_id = "ORG1"
        doc.lines = [line]
        db, _, _ = self._db(doc=doc, item=item)

        with patch(
            "app.services.repair_order_stock_reserve.release_shop_part_reservation"
        ):
            delete_receipt_document(db, org_id="ORG1", doc_id=7)

        self.assertEqual(item.quantity, 0)
        self.assertEqual(db.delete.call_args_list[0].args[0], doc)
        self.assertEqual(db.delete.call_args_list[1].args[0], item)

    def test_restores_my_parts_product_quantity(self):
        item = _item(quantity=2)
        product = MagicMock()
        product.quantity = 8
        line = _line(item=item, quantity=2, cart_item_type="my_parts", cart_item_id=55)
        doc = MagicMock()
        doc.id = 8
        doc.lines = [line]
        db, _, _ = self._db(doc=doc, item=item, product=product)

        with patch(
            "app.services.repair_order_stock_reserve.release_shop_part_reservation"
        ):
            delete_receipt_document(db, org_id="ORG1", doc_id=8)

        self.assertEqual(product.quantity, 10)
        self.assertEqual(item.quantity, 0)

    def test_blocks_when_return_exists(self):
        item = _item()
        line = _line(item=item)
        doc = MagicMock()
        doc.id = 9
        doc.lines = [line]
        db, _, _ = self._db(doc=doc, item=item, has_return=(1,))

        with self.assertRaises(HTTPException) as ctx:
            delete_receipt_document(db, org_id="ORG1", doc_id=9)

        self.assertEqual(ctx.exception.status_code, 400)
        db.delete.assert_not_called()

    def test_blocks_when_stock_already_written_off(self):
        item = _item(quantity=1)
        line = _line(item=item, quantity=4)
        doc = MagicMock()
        doc.id = 11
        doc.lines = [line]
        db, _, _ = self._db(doc=doc, item=item)

        with self.assertRaises(HTTPException) as ctx:
            delete_receipt_document(db, org_id="ORG1", doc_id=11)

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("списаны", ctx.exception.detail)

    def test_unlinks_shop_parts_from_receipt(self):
        item = _item(reserved=4)
        part = MagicMock()
        part.source = "autoservice_stock"
        part.autoservice_stock_item_id = item.id
        part.warehouse_receipt_id = 20
        line = _line(item=item, quantity=4)
        doc = MagicMock()
        doc.id = 12
        doc.lines = [line]
        db, shop_query, leftover_query = self._db(
            doc=doc, item=item, shop_parts=[part], leftover_parts=[]
        )
        leftover_query.filter.return_value.all.return_value = []

        with patch(
            "app.services.repair_order_stock_reserve.release_shop_part_reservation",
            side_effect=lambda _db, _part: setattr(item, "reserved_qty", 0),
        ) as release:
            delete_receipt_document(db, org_id="ORG1", doc_id=12)

        release.assert_called_once_with(db, part)
        self.assertEqual(part.source, "manual")
        self.assertIsNone(part.autoservice_stock_item_id)
        self.assertIsNone(part.warehouse_receipt_id)
        self.assertEqual(item.quantity, 0)


if __name__ == "__main__":
    unittest.main()
