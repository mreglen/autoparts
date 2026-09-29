import sys
import types
import unittest
from unittest.mock import MagicMock

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

import app.models  # noqa: F401

from app.models.autoservice_warehouse import (
    AutoserviceWarehouseExpense,
    AutoserviceWarehouseItem,
)
from app.models.repair_order import RepairOrder, RepairOrderShopPart
from app.services.autoservice_warehouse_service import (
    revert_autoservice_stock_for_order,
)


def _order(order_id=77, number="12", parts=()):
    order = RepairOrder()
    order.id = order_id
    order.organization_id = "ORG1"
    order.order_number = number
    order.status = "completed"
    order.shop_parts = list(parts)
    return order


def _part(consumed=True, item_id=5):
    part = RepairOrderShopPart()
    part.id = 31
    part.source = "autoservice_stock"
    part.autoservice_stock_item_id = item_id
    part.autoservice_stock_consumed = consumed
    return part


def _expense(item_id=5, qty=3, order_id=77):
    expense = AutoserviceWarehouseExpense()
    expense.id = 90
    expense.organization_id = "ORG1"
    expense.item_id = item_id
    expense.quantity = qty
    expense.repair_order_id = order_id
    return expense


def _db(expenses=(), items=()):
    db = MagicMock()

    def _query(model):
        q = MagicMock()
        if model is AutoserviceWarehouseExpense:
            q.options.return_value.filter.return_value.all.return_value = list(expenses)
        elif model is AutoserviceWarehouseItem:
            q.filter.return_value.with_for_update.return_value.all.return_value = list(items)
        return q

    db.query.side_effect = _query
    return db


class RevertAutoserviceStockTests(unittest.TestCase):
    def test_reverts_expense_restores_quantity_and_clears_flag(self):
        part = _part(consumed=True)
        order = _order(parts=[part])
        expense = _expense(qty=3)
        item = AutoserviceWarehouseItem()
        item.id = 5
        item.organization_id = "ORG1"
        item.quantity = 2
        db = _db(expenses=[expense], items=[item])

        restored = revert_autoservice_stock_for_order(db, org_id="ORG1", order=order)

        self.assertEqual(restored, 1)
        self.assertEqual(item.quantity, 5)
        self.assertFalse(part.autoservice_stock_consumed)
        db.delete.assert_called_once_with(expense)

    def test_no_expenses_is_noop(self):
        part = _part(consumed=False)
        order = _order(parts=[part])
        db = _db(expenses=[], items=[])

        restored = revert_autoservice_stock_for_order(db, org_id="ORG1", order=order)

        self.assertEqual(restored, 0)
        db.delete.assert_not_called()


if __name__ == "__main__":
    unittest.main()
