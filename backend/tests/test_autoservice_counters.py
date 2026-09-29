import sys
import types
import unittest
from unittest.mock import MagicMock

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

import app.models  # noqa: F401

from app.models.autoservice_counter import AutoserviceCounter
from app.services.autoservice_counters import (
    COUNTER_AUTOSERVICE_PAYMENT,
    COUNTER_REPAIR_ORDER,
    next_counter_value,
)
from app.utils.repair_order_number import allocate_repair_order_number


def _counter_query(counter_row):
    q = MagicMock()
    q.filter.return_value.with_for_update.return_value.first.return_value = counter_row
    q.filter.return_value.with_for_update.return_value.one.return_value = counter_row
    return q


def _db(counter_row=None, order_numbers=(), payment_max=None):
    db = MagicMock()

    def _query(arg):
        if arg is AutoserviceCounter:
            return _counter_query(counter_row)
        q = MagicMock()
        q.filter.return_value.all.return_value = [(n,) for n in order_numbers]
        q.filter.return_value.scalar.return_value = payment_max
        return q

    db.query.side_effect = _query
    return db


def _counter(value):
    row = AutoserviceCounter()
    row.organization_id = "ORG1"
    row.kind = COUNTER_REPAIR_ORDER
    row.value = value
    return row


class NextCounterValueTests(unittest.TestCase):
    def test_existing_counter_increments(self):
        row = _counter(7)
        db = _db(counter_row=row)

        result = next_counter_value(db, "ORG1", COUNTER_REPAIR_ORDER)

        self.assertEqual(result, 8)
        self.assertEqual(row.value, 8)
        db.flush.assert_called()

    def test_seed_from_existing_order_numbers(self):
        db = _db(order_numbers=["3", "abc", "10", ""])

        result = next_counter_value(db, "ORG1", COUNTER_REPAIR_ORDER)

        self.assertEqual(result, 11)
        added = db.add.call_args[0][0]
        self.assertIsInstance(added, AutoserviceCounter)
        # seeded at current max (10), then incremented to the returned value
        self.assertEqual(added.value, 11)

    def test_seed_from_payment_max(self):
        db = _db(payment_max=41)

        result = next_counter_value(db, "ORG1", COUNTER_AUTOSERVICE_PAYMENT)

        self.assertEqual(result, 42)

    def test_allocate_repair_order_number_returns_string(self):
        db = _db(counter_row=_counter(4))

        self.assertEqual(allocate_repair_order_number(db, "ORG1"), "5")


if __name__ == "__main__":
    unittest.main()
