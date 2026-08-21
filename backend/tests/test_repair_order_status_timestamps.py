import unittest
from datetime import datetime
from unittest.mock import MagicMock

from app.services.repair_order_status_timestamps import (
    normalize_repair_order_status,
    record_repair_order_status_timestamp,
)


class RepairOrderStatusTimestampTests(unittest.TestCase):
    def test_normalize_legacy_statuses(self):
        self.assertEqual(normalize_repair_order_status("accepted"), "pending")
        self.assertEqual(normalize_repair_order_status("open"), "pending")
        self.assertEqual(normalize_repair_order_status("ready"), "completed")
        self.assertEqual(normalize_repair_order_status("in_progress"), "in_progress")

    def test_record_status_timestamp(self):
        order = MagicMock()
        order.status_in_progress_at = None
        fixed_at = datetime(2026, 8, 19, 14, 30, 0)

        record_repair_order_status_timestamp(order, "in_progress", at=fixed_at)

        self.assertEqual(order.status_in_progress_at, fixed_at)

    def test_completed_sets_scheduled_end_at(self):
        order = MagicMock()
        order.status_completed_at = None
        order.scheduled_end_at = datetime(2026, 8, 1, 10, 0, 0)
        fixed_at = datetime(2026, 8, 19, 16, 45, 0)

        record_repair_order_status_timestamp(order, "completed", at=fixed_at)

        self.assertEqual(order.status_completed_at, fixed_at)
        self.assertEqual(order.scheduled_end_at, fixed_at)

    def test_record_ignores_unknown_status(self):
        order = MagicMock(spec=[])
        record_repair_order_status_timestamp(order, "unknown")
        self.assertEqual(order.method_calls, [])


if __name__ == "__main__":
    unittest.main()
