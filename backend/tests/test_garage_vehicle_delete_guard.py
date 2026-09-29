import sys
import types
import unittest
from unittest.mock import MagicMock, patch

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

import app.models  # noqa: F401

from fastapi import HTTPException

from app.models.autoservice_client import AutoserviceClient
from app.models.garage_vehicle import GarageVehicle
from app.models.inspection_booking import InspectionBooking
from app.models.repair_order import RepairOrder
from app.routers.autoservice_garage import delete_garage_vehicle


def _db(orders_count=0, bookings_count=0):
    db = MagicMock()

    def _query(arg):
        q = MagicMock()
        if arg is RepairOrder.id:
            q.filter.return_value.count.return_value = orders_count
        elif arg is InspectionBooking.id:
            q.filter.return_value.count.return_value = bookings_count
        return q

    db.query.side_effect = _query
    return db


def _client():
    client = AutoserviceClient()
    client.id = 3
    client.organization_id = "ORG1"
    client.status = "active"
    return client


def _vehicle():
    vehicle = GarageVehicle()
    vehicle.id = 7
    return vehicle


class DeleteGarageVehicleGuardTests(unittest.TestCase):
    def _call(self, db):
        with patch(
            "app.routers.autoservice_garage.require_my_active_autoservice_client",
            return_value=_client(),
        ), patch(
            "app.routers.autoservice_garage._get_client_vehicle_or_404",
            return_value=_vehicle(),
        ):
            return delete_garage_vehicle(7, db=db, current_user=MagicMock())

    def test_blocks_when_orders_exist(self):
        db = _db(orders_count=2, bookings_count=0)

        with self.assertRaises(HTTPException) as ctx:
            self._call(db)

        self.assertEqual(ctx.exception.status_code, 400)
        db.delete.assert_not_called()

    def test_blocks_when_bookings_exist(self):
        db = _db(orders_count=0, bookings_count=1)

        with self.assertRaises(HTTPException) as ctx:
            self._call(db)

        self.assertEqual(ctx.exception.status_code, 400)
        db.delete.assert_not_called()

    def test_deletes_when_no_history(self):
        db = _db(orders_count=0, bookings_count=0)

        self._call(db)

        db.delete.assert_called_once()
        db.commit.assert_called_once()


if __name__ == "__main__":
    unittest.main()
