import sys
import types
import unittest
from decimal import Decimal
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
    AutoserviceWarehouseReturnRequest,
)
from app.services.autoservice_warehouse_return_service import (
    create_warehouse_return,
    update_warehouse_return_status,
)


def _receipt(*, reserved=0, return_reserved=0, returned=0):
    item = MagicMock()
    item.id = 10
    item.organization_id = "ORG1"
    item.quantity = 5
    item.reserved_qty = reserved
    item.return_reserved_qty = return_reserved
    item.brand = "MANN"
    item.article = "W712"
    item.name = "Фильтр"

    doc = MagicMock()
    doc.source_order_type = "new"
    doc.source_order_id = 77
    doc.supplier_name = "Rossko"

    receipt = MagicMock()
    receipt.id = 20
    receipt.organization_id = "ORG1"
    receipt.item_id = item.id
    receipt.item = item
    receipt.document = doc
    receipt.cart_item_type = "new"
    receipt.cart_item_id = 33
    receipt.quantity = 5
    receipt.return_reserved_qty = return_reserved
    receipt.returned_qty = returned
    receipt.unit_price = Decimal("100.00")
    return receipt, item


class CreateWarehouseReturnTests(unittest.TestCase):
    def _db_for_create(self, receipt, item, saved=None):
        db = MagicMock()
        receipt_query = MagicMock()
        item_query = MagicMock()
        return_query = MagicMock()
        receipt_query.filter.return_value.with_for_update.return_value.first.return_value = receipt
        item_query.filter.return_value.with_for_update.return_value.first.return_value = item
        return_query.filter.return_value.first.return_value = None
        return_query.options.return_value.filter.return_value.first.return_value = saved

        def query_for(model):
            if model is AutoserviceWarehouseReceipt:
                return receipt_query
            if model is AutoserviceWarehouseItem:
                return item_query
            if model is AutoserviceWarehouseReturnRequest:
                return return_query
            return MagicMock()

        db.query.side_effect = query_for
        return db

    def test_blocks_when_item_reserved_for_repair_order(self):
        receipt, item = _receipt(reserved=1)
        db = self._db_for_create(receipt, item)

        with self.assertRaises(HTTPException) as ctx:
            create_warehouse_return(
                db,
                org_id="ORG1",
                user=MagicMock(id=5),
                receipt_id=receipt.id,
                quantity=1,
                reason="defect",
                comment=None,
                photo_urls=[],
            )

        self.assertEqual(ctx.exception.status_code, 409)
        self.assertIn("заказ-наряда", ctx.exception.detail)
        db.add.assert_not_called()

    def test_reserves_receipt_and_aggregate_item(self):
        receipt, item = _receipt()
        saved = MagicMock(spec=AutoserviceWarehouseReturnRequest)
        saved.id = 1
        saved.item = item

        db = self._db_for_create(receipt, item, saved)

        with patch(
            "app.services.autoservice_warehouse_return_service._provider_meta",
            return_value=("rossko", None, "manual"),
        ):
            result = create_warehouse_return(
                db,
                org_id="ORG1",
                user=MagicMock(id=5),
                receipt_id=receipt.id,
                quantity=2,
                reason="defect",
                comment="Упаковка повреждена",
                photo_urls=["/uploads/a.jpg"],
            )

        self.assertIs(result, saved)
        self.assertEqual(receipt.return_reserved_qty, 2)
        self.assertEqual(item.return_reserved_qty, 2)
        db.commit.assert_called_once()


class UpdateWarehouseReturnStatusTests(unittest.TestCase):
    def _row(self, status_code="requested"):
        row = MagicMock(spec=AutoserviceWarehouseReturnRequest)
        row.id = 3
        row.organization_id = "ORG1"
        row.supplier_organization_id = "SELLER1"
        row.item_id = 10
        row.receipt_id = 20
        row.quantity = 2
        row.unit_price = Decimal("100.00")
        row.created_by = 5
        row.status_code = status_code
        return row

    def _db_for_update(self, row, item, receipt):
        db = MagicMock()
        return_query = MagicMock()
        item_query = MagicMock()
        receipt_query = MagicMock()
        return_query.filter.return_value.with_for_update.return_value.first.return_value = row
        item_query.filter.return_value.with_for_update.return_value.first.return_value = item
        receipt_query.filter.return_value.with_for_update.return_value.first.return_value = receipt

        def query_for(model):
            if model is AutoserviceWarehouseReturnRequest:
                return return_query
            if model is AutoserviceWarehouseItem:
                return item_query
            if model is AutoserviceWarehouseReceipt:
                return receipt_query
            return MagicMock()

        db.query.side_effect = query_for
        return db

    def test_rejected_releases_both_return_reserves(self):
        row = self._row()
        item = MagicMock(id=10, return_reserved_qty=2, quantity=5)
        receipt = MagicMock(id=20, return_reserved_qty=2, returned_qty=0)
        db = self._db_for_update(row, item, receipt)

        update_warehouse_return_status(
            db,
            return_id=row.id,
            new_status="rejected",
            seller_note="Не согласовано",
            supplier_org_id="SELLER1",
        )

        self.assertEqual(item.return_reserved_qty, 0)
        self.assertEqual(receipt.return_reserved_qty, 0)
        self.assertEqual(row.status_code, "rejected")

    def test_sent_decrements_stock_and_creates_linked_expense(self):
        row = self._row(status_code="approved")
        item = MagicMock(id=10, return_reserved_qty=2, quantity=5)
        receipt = MagicMock(id=20, return_reserved_qty=2, returned_qty=0)
        db = self._db_for_update(row, item, receipt)

        update_warehouse_return_status(
            db,
            return_id=row.id,
            new_status="sent",
            seller_note=None,
            supplier_org_id="SELLER1",
        )

        self.assertEqual(item.quantity, 3)
        self.assertEqual(item.return_reserved_qty, 0)
        self.assertEqual(receipt.return_reserved_qty, 0)
        self.assertEqual(receipt.returned_qty, 2)
        expense = db.add.call_args.args[0]
        self.assertIsInstance(expense, AutoserviceWarehouseExpense)
        self.assertEqual(expense.return_request_id, row.id)


if __name__ == "__main__":
    unittest.main()
