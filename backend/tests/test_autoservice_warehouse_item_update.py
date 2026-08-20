import sys
import types
import unittest
from decimal import Decimal
from unittest.mock import MagicMock

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

import app.models  # noqa: F401
import app.models.autoservice_client  # noqa: F401
import app.models.repair_order  # noqa: F401

from fastapi import HTTPException

from app.models.autoservice_warehouse import AutoserviceWarehouseItem
from app.services.autoservice_warehouse_service import (
    _ensure_unique_warehouse_item_identity,
    update_autoservice_warehouse_item,
)


class WarehouseItemIdentityTests(unittest.TestCase):
    def test_allows_multiple_items_without_brand_and_article(self):
        db = MagicMock()
        _ensure_unique_warehouse_item_identity(
            db,
            org_id="ORG1",
            item_id=5,
            brand="",
            article="",
        )
        db.query.assert_not_called()

    def test_rejects_duplicate_brand_and_article(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = MagicMock(id=6)

        with self.assertRaises(HTTPException) as ctx:
            _ensure_unique_warehouse_item_identity(
                db,
                org_id="ORG1",
                item_id=5,
                brand="MANN",
                article="W712",
            )

        self.assertEqual(ctx.exception.status_code, 400)

    def test_update_allows_empty_brand_and_article(self):
        item = MagicMock(spec=AutoserviceWarehouseItem)
        item.id = 5
        item.brand = "MANN"
        item.article = "W712"

        db = MagicMock()
        item_query = MagicMock()
        parts_query = MagicMock()
        item_query.filter.return_value.with_for_update.return_value.first.return_value = item
        parts_query.filter.return_value.all.return_value = []
        db.query.side_effect = [item_query, parts_query]

        result = update_autoservice_warehouse_item(
            db,
            org_id="ORG1",
            item_id=5,
            brand="",
            article="",
            name="Проводка двери",
            unit="pcs",
            unit_price=Decimal("1200.00"),
        )

        self.assertIs(result, item)
        self.assertEqual(item.brand, "")
        self.assertEqual(item.article, "")
        self.assertEqual(item.unit_price, Decimal("1200.00"))
        db.flush.assert_called_once()


if __name__ == "__main__":
    unittest.main()
