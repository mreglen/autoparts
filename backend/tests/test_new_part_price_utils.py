import unittest
from unittest.mock import MagicMock, patch

from app.utils.new_part_price_utils import apply_markup_price, min_stock_price_with_markup


class NewPartPriceUtilsTests(unittest.TestCase):
    def test_apply_markup_price(self):
        self.assertEqual(apply_markup_price(1000, 15), 1150.0)
        self.assertIsNone(apply_markup_price(0, 15))

    @patch("app.services.new_parts_seo_card_service._stocks_from_card")
    def test_min_stock_price_with_markup_from_stocks(self, mock_stocks):
        mock_stocks.return_value = [
            {"stock_id": "a", "price": 1000, "available_count": 2},
            {"stock_id": "b", "price": 900, "available_count": 1},
        ]
        card = MagicMock()
        card.price = 1100
        self.assertEqual(min_stock_price_with_markup(card, 15), 1035.0)

    @patch("app.services.new_parts_seo_card_service._stocks_from_card")
    def test_min_stock_price_fallback_to_card_price(self, mock_stocks):
        mock_stocks.return_value = []
        card = MagicMock()
        card.price = 1000
        self.assertEqual(min_stock_price_with_markup(card, 10), 1100.0)


if __name__ == "__main__":
    unittest.main()
