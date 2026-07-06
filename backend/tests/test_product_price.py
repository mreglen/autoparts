import unittest

from app.utils.product_price import round_product_price, display_product_price


class RoundProductPriceTests(unittest.TestCase):
    def test_rounds_to_whole_rubles(self):
        self.assertEqual(round_product_price(1234.56), 1235.0)
        self.assertEqual(round_product_price(1234.49), 1234.0)
        self.assertEqual(round_product_price(1000), 1000.0)

    def test_none_for_invalid(self):
        self.assertIsNone(round_product_price(None))
        self.assertIsNone(round_product_price(0))
        self.assertIsNone(round_product_price(-10))

    def test_display_respects_flag(self):
        self.assertEqual(display_product_price(999.99, round_kopecks=True), 1000.0)
        self.assertEqual(display_product_price(999.99, round_kopecks=False), 999.99)


if __name__ == "__main__":
    unittest.main()
