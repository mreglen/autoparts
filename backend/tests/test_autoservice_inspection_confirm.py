import sys
import types
import unittest
from datetime import date, time
from unittest.mock import MagicMock, patch

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

import app.models  # noqa: F401

from fastapi import HTTPException

from app.routers import autoservice_inspections as inspections_router
from app.routers import autoservice_repair_bookings as repair_bookings_router
from app.schemas.inspection_booking import (
    InspectionBookingPatch,
    InspectionBookingStaffCreate,
)
from app.schemas.repair_booking import RepairBookingStaffCreate

MOD = "app.routers.autoservice_inspections"


def _payload():
    return InspectionBookingStaffCreate(
        name="Иван Петров",
        phone="+7 999 123-45-67",
        preferred_date=date(2026, 10, 5),
        preferred_time=time(11, 0),
    )


class StaffBookingCreateTests(unittest.TestCase):
    def _create(self, can_confirm):
        db = MagicMock()
        user = MagicMock()
        user.id = 5
        user.is_admin = False
        with patch(
            f"{MOD}.has_autoservice_permission", return_value=can_confirm
        ), patch(
            f"{MOD}.notify_inspection_booking_client"
        ) as notify, patch(
            f"{MOD}._booking_to_view", side_effect=lambda r: r
        ):
            row = inspections_router._create_staff_inspection_booking(
                _payload(), db, user, "ORG1"
            )
        return row, notify

    def test_without_confirm_permission_booking_stays_new(self):
        row, notify = self._create(can_confirm=False)
        self.assertEqual(row.status, "new")
        self.assertEqual(row.source, "staff")
        notify.assert_not_called()

    def test_with_confirm_permission_booking_confirmed(self):
        row, notify = self._create(can_confirm=True)
        self.assertEqual(row.status, "confirmed")
        notify.assert_called_once()


class LegacyStaffRepairBookingTests(unittest.TestCase):
    def _create(self, can_confirm):
        db = MagicMock()
        user = MagicMock()
        user.id = 5
        payload = RepairBookingStaffCreate(
            name="Иван Петров",
            phone="+7 999 123-45-67",
            preferred_date=date(2026, 10, 5),
        )
        RMOD = "app.routers.autoservice_repair_bookings"
        with patch(
            f"{RMOD}.require_autoservice_permission", return_value="ORG1"
        ), patch(
            f"{RMOD}.has_autoservice_permission", return_value=can_confirm
        ), patch(
            f"{RMOD}._inspection_to_repair_view", side_effect=lambda r: r
        ):
            return repair_bookings_router.create_repair_booking_staff(
                payload=payload, db=db, current_user=user
            )

    def test_legacy_staff_booking_auto_confirms_with_permission(self):
        row = self._create(can_confirm=True)
        self.assertEqual(row.status, "confirmed")
        self.assertEqual(row.source, "staff")

    def test_legacy_staff_booking_stays_new_without_permission(self):
        row = self._create(can_confirm=False)
        self.assertEqual(row.status, "new")


class PatchConfirmGuardTests(unittest.TestCase):
    def _patch(self, can_confirm):
        db = MagicMock()
        booking = MagicMock()
        booking.id = 10
        booking.status = "new"
        q = MagicMock()
        q.options.return_value = q
        q.filter.return_value = q
        q.first.return_value = booking
        db.query.return_value = q
        user = MagicMock()
        with patch(
            f"{MOD}.require_autoservice_permission", return_value="ORG1"
        ), patch(
            f"{MOD}.has_autoservice_permission", return_value=can_confirm
        ), patch(
            f"{MOD}._booking_to_view", side_effect=lambda r: r
        ), patch(f"{MOD}.notify_inspection_booking_client"):
            return inspections_router.patch_inspection_booking(
                booking_id=10,
                payload=InspectionBookingPatch(status="confirmed"),
                db=db,
                current_user=user,
            )

    def test_confirm_forbidden_without_permission(self):
        with self.assertRaises(HTTPException) as ctx:
            self._patch(can_confirm=False)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_confirm_allowed_with_permission(self):
        self._patch(can_confirm=True)


if __name__ == "__main__":
    unittest.main()
