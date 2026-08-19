import sys
import types
import unittest
from unittest.mock import MagicMock

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

import app.models  # noqa: F401
import app.models.autoservice_client  # noqa: F401
import app.models.repair_order  # noqa: F401

from fastapi import HTTPException

from app.models.autoservice_warehouse import AutoserviceWarehouseItem
from app.services.autoservice_warehouse_service import update_autoservice_warehouse_item


class UpdateWarehouseItemConflictTests(unittest.TestCase):
    def test_rejects_empty_brand_and_article_when_another_item_exists(self):
        item = MagicMock(spec=AutoserviceWarehouseItem)
        item.id = 5
        item.brand = "MANN"
        item.article = "W712"
        conflict = MagicMock(id=6)

        db = MagicMock()
        item_query = MagicMock()
        conflict_query = MagicMock()
        item_query.filter.return_value.with_for_update.return_value.first.return_value = item
        conflict_query.filter.return_value.first.return_value = conflict
        db.query.side_effect = [item_query, conflict_query]

        with self.assertRaises(HTTPException) as ctx:
            update_autoservice_warehouse_item(
                db,
                org_id="ORG1",
                item_id=5,
                brand="",
                article="",
                name="Фильтр",
                unit="pcs",
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("без бренда и артикула", ctx.exception.detail)
        db.flush.assert_not_called()


if __name__ == "__main__":
    unittest.main()
