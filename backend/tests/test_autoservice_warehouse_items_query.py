import sys
import types
import unittest

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

from unittest import mock

from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker

from app.db.database import Base
from app.models.autoservice_warehouse import AutoserviceWarehouseItem
from app.routers import autoservice_warehouse as wh

ORG = "ORG1"


@compiles(JSONB, "sqlite")
def _jsonb_as_sqlite_json(element, compiler, **kw):
    return "JSON"


class AutoserviceWarehouseItemsQueryTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.addCleanup(self.db.close)

    def _add(self, name, *, quantity, reserved=0, unit="pcs"):
        item = AutoserviceWarehouseItem(
            organization_id=ORG,
            brand="",
            article="",
            name=name,
            quantity=quantity,
            reserved_qty=reserved,
            unit=unit,
            unit_price=100,
        )
        self.db.add(item)
        return item

    def _list(self, **kwargs):
        params = {"q": "", "supplier": "", "available_only": False, "exclude_zero_qty": False}
        params.update(kwargs)
        with mock.patch.object(wh, "require_autoservice_permission", return_value=ORG):
            rows = wh.list_autoservice_warehouse_items(
                db=self.db, current_user=mock.MagicMock(), **params
            )
        return [row.name for row in rows]

    def test_in_stock_item_beyond_the_old_window_is_returned(self):
        for index in range(250):
            self._add(f"AAA {index:03d}", quantity=0)
        self._add("PEMCO 5W-30", quantity=19, unit="l")
        self.db.commit()

        self.assertIn("PEMCO 5W-30", self._list(exclude_zero_qty=True))

    def test_search_matches_item_beyond_the_old_window(self):
        for index in range(250):
            self._add(f"AAA {index:03d}", quantity=5)
        self._add("PEMCO 5W-30", quantity=19, unit="l")
        self.db.commit()

        self.assertEqual(self._list(q="5w-30", exclude_zero_qty=True), ["PEMCO 5W-30"])

    def test_available_only_drops_fully_reserved_item(self):
        self._add("В резерве", quantity=5, reserved=5)
        self._add("Свободно", quantity=5, reserved=1)
        self.db.commit()

        self.assertEqual(self._list(available_only=True), ["Свободно"])


if __name__ == "__main__":
    unittest.main()
