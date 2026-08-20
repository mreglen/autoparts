import sys
import types
import unittest
from unittest.mock import MagicMock, patch

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

import app.models  # noqa: F401
import app.models.autoservice_client  # noqa: F401
import app.models.repair_order  # noqa: F401

from app.models.repair_order import RepairOrder
from app.services.repair_order_delete import delete_repair_order


class RepairOrderDeleteTests(unittest.TestCase):
    def test_delete_active_order_releases_reservations(self):
        order = MagicMock(spec=RepairOrder)
        order.id = 7
        order.status = "pending"
        order.order_number = "3"

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = order

        with patch("app.services.repair_order_delete.release_order_reservations") as release:
            with patch("app.services.repair_order_delete.clear_order_accruals") as clear_accruals:
                delete_repair_order(db, org_id="ORG1", order_id=7)

        release.assert_called_once_with(db, order)
        clear_accruals.assert_called_once_with(db, 7)
        db.delete.assert_called_once_with(order)
        db.flush.assert_called_once()

    def test_delete_completed_order_restores_stock(self):
        order = MagicMock(spec=RepairOrder)
        order.id = 8
        order.status = "completed"
        order.order_number = "5"

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = order

        with patch("app.services.repair_order_delete._restore_completed_order_stock") as restore:
            with patch("app.services.repair_order_delete.clear_order_accruals"):
                delete_repair_order(db, org_id="ORG1", order_id=8)

        restore.assert_called_once_with(db, org_id="ORG1", order=order)
        db.delete.assert_called_once_with(order)


if __name__ == "__main__":
    unittest.main()
