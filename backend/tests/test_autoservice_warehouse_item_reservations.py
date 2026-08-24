import sys
import types
import unittest
from decimal import Decimal
from unittest.mock import MagicMock

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

import app.models  # noqa: F401
import app.models.repair_order  # noqa: F401

from fastapi import HTTPException

from app.models.autoservice_warehouse import AutoserviceWarehouseItem
from app.models.repair_order import RepairOrder, RepairOrderShopPart
from app.services.autoservice_warehouse_service import list_autoservice_warehouse_item_reservations


class WarehouseItemReservationsTests(unittest.TestCase):
    def test_returns_404_when_item_missing(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        with self.assertRaises(HTTPException) as ctx:
            list_autoservice_warehouse_item_reservations(db, org_id="ORG1", item_id=99)

        self.assertEqual(ctx.exception.status_code, 404)

    def test_aggregates_reservations_by_repair_order(self):
        item = MagicMock(spec=AutoserviceWarehouseItem)
        item.id = 10
        item.unit = "pcs"

        order_a = MagicMock(spec=RepairOrder)
        order_a.id = 1
        order_a.order_number = "A-100"
        order_a.status = "in_progress"

        order_b = MagicMock(spec=RepairOrder)
        order_b.id = 2
        order_b.order_number = "A-200"
        order_b.status = "accepted"

        part_a = MagicMock(spec=RepairOrderShopPart)
        part_a.order = order_a
        part_a.qty = Decimal("2")
        part_a.unit = "pcs"

        part_b = MagicMock(spec=RepairOrderShopPart)
        part_b.order = order_b
        part_b.qty = Decimal("4")
        part_b.unit = "pcs"

        item_query = MagicMock()
        item_query.filter.return_value.first.return_value = item

        receipt_query = MagicMock()
        receipt_query.filter.return_value.all.return_value = []

        parts_query = MagicMock()
        parts_query.join.return_value.filter.return_value.order_by.return_value.all.return_value = [
            (part_a, order_a),
            (part_b, order_b),
        ]

        db = MagicMock()
        db.query.side_effect = [item_query, receipt_query, parts_query]

        rows = list_autoservice_warehouse_item_reservations(db, org_id="ORG1", item_id=10)

        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["repair_order_id"], 1)
        self.assertEqual(rows[0]["qty"], Decimal("2"))
        self.assertEqual(rows[1]["repair_order_id"], 2)
        self.assertEqual(rows[1]["qty"], Decimal("4"))


if __name__ == "__main__":
    unittest.main()
