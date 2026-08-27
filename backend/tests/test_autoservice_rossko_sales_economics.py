import unittest
from decimal import Decimal

from app.services.autoservice_rossko_sales_economics import compute_line_economics, compute_order_economics


class RosskoSalesEconomicsTests(unittest.TestCase):
    def test_positive_margin_splits_7_percent_to_site(self):
        result = compute_order_economics(
            sale_total=Decimal("1000.00"),
            supplier_total=Decimal("700.00"),
            acquiring_fee=Decimal("30.00"),
            refund_amount=Decimal("0.00"),
        )
        self.assertEqual(result["margin"], Decimal("270.00"))
        self.assertEqual(result["site_income"], Decimal("18.90"))
        self.assertEqual(result["organization_income"], Decimal("251.10"))
        self.assertFalse(result["pending_acquiring"])

    def test_negative_margin_goes_to_organization_only(self):
        result = compute_order_economics(
            sale_total=Decimal("500.00"),
            supplier_total=Decimal("520.00"),
            acquiring_fee=Decimal("10.00"),
            refund_amount=Decimal("0.00"),
        )
        self.assertEqual(result["margin"], Decimal("-30.00"))
        self.assertEqual(result["site_income"], Decimal("0.00"))
        self.assertEqual(result["organization_income"], Decimal("-30.00"))

    def test_refund_reduces_margin(self):
        result = compute_order_economics(
            sale_total=Decimal("1000.00"),
            supplier_total=Decimal("700.00"),
            acquiring_fee=Decimal("30.00"),
            refund_amount=Decimal("200.00"),
        )
        self.assertEqual(result["margin"], Decimal("70.00"))
        self.assertEqual(result["site_income"], Decimal("4.90"))
        self.assertEqual(result["organization_income"], Decimal("65.10"))

    def test_pending_acquiring_when_fee_missing(self):
        result = compute_order_economics(
            sale_total=Decimal("1000.00"),
            supplier_total=Decimal("700.00"),
            acquiring_fee=None,
            refund_amount=Decimal("0.00"),
        )
        self.assertTrue(result["pending_acquiring"])
        self.assertIsNone(result["margin"])
        self.assertIsNone(result["site_income"])

    def test_line_allocation_is_proportional(self):
        line = compute_line_economics(
            quantity=2,
            sale_unit_price=Decimal("500.00"),
            supplier_unit_price=Decimal("350.00"),
            acquiring_fee_total=Decimal("30.00"),
            sale_order_total=Decimal("1000.00"),
            refund_amount=Decimal("0.00"),
            order_sale_total=Decimal("1000.00"),
        )
        self.assertEqual(line["line_sale"], Decimal("1000.00"))
        self.assertEqual(line["acquiring_fee"], Decimal("30.00"))
        self.assertEqual(line["margin"], Decimal("270.00"))


if __name__ == "__main__":
    unittest.main()
