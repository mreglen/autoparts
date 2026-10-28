import sys
import types
import unittest
from datetime import date, datetime, time
from types import SimpleNamespace
from unittest.mock import MagicMock

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

import app.models  # noqa: F401

from app.services.autoservice_inspection_duplicates import (
    booking_slot,
    covered_inspection_slots,
    filter_covered_bookings,
    find_covered_bookings,
)


def _booking(**kwargs):
    data = {
        "id": 1,
        "organization_id": "ORG1",
        "client_id": 77,
        "name": "Марат",
        "preferred_date": date(2026, 10, 28),
        "preferred_time": time(11, 0),
        "status": "confirmed",
    }
    data.update(kwargs)
    return SimpleNamespace(**data)


def _slot_rows():
    return [
        (77, datetime(2026, 10, 28, 11, 0, 0, 123456), 101, "101"),
        (77, datetime(2026, 9, 2, 8, 30), 102, "102"),
    ]


class BookingSlotTests(unittest.TestCase):
    def test_slot_uses_preferred_time(self):
        self.assertEqual(booking_slot(_booking()), datetime(2026, 10, 28, 11, 0))

    def test_slot_without_time_is_midnight(self):
        booking = _booking(preferred_time=None)
        self.assertEqual(booking_slot(booking), datetime(2026, 10, 28, 0, 0))


class CoveredSlotsTests(unittest.TestCase):
    def test_microseconds_are_normalized(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = _slot_rows()

        slots = covered_inspection_slots(db, "ORG1")

        self.assertEqual(slots[(77, datetime(2026, 10, 28, 11, 0))], "№ 101")

    def test_orders_without_slots_give_empty_dict(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = []

        self.assertEqual(covered_inspection_slots(db, "ORG1", date(2026, 10, 26), date(2026, 11, 1)), {})


class FilterCoveredBookingsTests(unittest.TestCase):
    def setUp(self):
        self.slots = {(77, datetime(2026, 10, 28, 11, 0)): "№ 101"}

    def test_same_client_same_slot_is_hidden(self):
        self.assertEqual(filter_covered_bookings([_booking()], self.slots), [])

    def test_other_time_stays_visible(self):
        booking = _booking(preferred_time=time(14, 0))
        self.assertEqual(filter_covered_bookings([booking], self.slots), [booking])

    def test_other_client_stays_visible(self):
        booking = _booking(client_id=78, name="Марат")
        self.assertEqual(filter_covered_bookings([booking], self.slots), [booking])

    def test_booking_without_client_id_stays_visible(self):
        booking = _booking(client_id=None)
        self.assertEqual(filter_covered_bookings([booking], self.slots), [booking])

    def test_no_slots_skips_filtering(self):
        booking = _booking()
        self.assertEqual(filter_covered_bookings([booking], {}), [booking])


class FindCoveredBookingsTests(unittest.TestCase):
    def test_returns_booking_with_order_label(self):
        booking = _booking()
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = _slot_rows()
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [
            booking,
            _booking(client_id=None),
        ]

        rows = find_covered_bookings(db, "ORG1")

        self.assertEqual(rows, [(booking, "№ 101")])


if __name__ == "__main__":
    unittest.main()
