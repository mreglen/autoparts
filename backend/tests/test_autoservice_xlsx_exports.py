import sys
import types
import unittest
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import patch

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

import app.models  # noqa: F401

import app.services.autoservice_finance_receipts_xlsx as receipts_xlsx
from app.schemas.autoservice_finance import (
    AutoserviceFinanceReceiptRow,
    AutoserviceFinanceReceiptsResponse,
    AutoservicePaymentMethodTotals,
)
from app.services.finance_xlsx_export import naive_datetime


class NaiveDatetimeTests(unittest.TestCase):
    def test_strips_tzinfo(self):
        aware = datetime(2026, 9, 29, 19, 28, tzinfo=timezone.utc)
        result = naive_datetime(aware)
        self.assertIsNone(result.tzinfo)
        self.assertEqual(result.replace(tzinfo=timezone.utc), aware)

    def test_naive_and_none_pass_through(self):
        naive = datetime(2026, 9, 29, 19, 28)
        self.assertIs(naive_datetime(naive), naive)
        self.assertIsNone(naive_datetime(None))


class ReceiptsWorkbookTests(unittest.TestCase):
    def test_aware_datetime_does_not_crash(self):
        aware = datetime(2026, 9, 29, 19, 28, tzinfo=timezone.utc)
        row = AutoserviceFinanceReceiptRow(
            id=1,
            sequential_number=1,
            repair_order_id=27,
            repair_order_number="27",
            client_name="Иван",
            amount=Decimal("21661.00"),
            method="card",
            created_at=aware,
            paid_at=aware,
        )
        report = AutoserviceFinanceReceiptsResponse(
            totals=AutoservicePaymentMethodTotals(card=Decimal("21661")),
            total_amount=Decimal("21661"),
            count=1,
            items=[row],
        )
        with patch.object(
            receipts_xlsx, "list_finance_receipts", return_value=report
        ):
            data = receipts_xlsx.build_finance_receipts_workbook_bytes(
                None, "ORG1", date(2026, 9, 1), date(2026, 9, 29)
            )
        self.assertGreater(len(data), 1000)


if __name__ == "__main__":
    unittest.main()
