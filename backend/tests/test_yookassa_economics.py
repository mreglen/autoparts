import unittest
from types import SimpleNamespace

from app.services.yookassa_economics import apply_refund_economics, apply_yookassa_economics


class YookassaEconomicsTests(unittest.TestCase):
    def test_apply_yookassa_economics_from_income_amount(self):
        row = SimpleNamespace(
            amount_value=1000.0,
            income_amount=None,
            acquiring_fee_amount=None,
        )
        apply_yookassa_economics(
            row,
            {
                "amount": {"value": "1000.00", "currency": "RUB"},
                "income_amount": {"value": "970.00", "currency": "RUB"},
            },
        )
        self.assertEqual(row.income_amount, 970.0)
        self.assertEqual(row.acquiring_fee_amount, 30.0)

    def test_apply_refund_economics(self):
        row = SimpleNamespace(
            amount_value=1000.0,
            refund_amount=None,
            refunded_at=None,
        )
        apply_refund_economics(
            row,
            {
                "status": "succeeded",
                "amount": {"value": "1000.00", "currency": "RUB"},
                "created_at": "2026-08-10T12:00:00.000Z",
            },
        )
        self.assertEqual(row.refund_amount, 1000.0)
        self.assertIsNotNone(row.refunded_at)


if __name__ == "__main__":
    unittest.main()
