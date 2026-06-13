import unittest
from unittest.mock import MagicMock, patch

from app.services.search_resolve_service import resolve_search_query


class ResolveSearchQueryTests(unittest.TestCase):
    def _product(self):
        product = MagicMock()
        product.id = 10
        product.brand = "MANN"
        product.article = "IF1009"
        return product

    @patch("app.services.search_resolve_service.find_indexable_used_catalog_product")
    def test_indexable_used_catalog_redirect(self, mock_find):
        product = self._product()
        mock_find.return_value = (product, "article")
        db = MagicMock()

        result = resolve_search_query(db, "IF1009", site_origin="https://svoygarage.ru")

        self.assertEqual(result.status, "redirect")
        self.assertEqual(result.redirect_path, "/autoparts/used?q=IF1009")
        self.assertEqual(result.redirect_url, "https://svoygarage.ru/autoparts/used?q=IF1009")
        self.assertEqual(result.match_type, "article")

    @patch("app.services.search_resolve_service.find_active_new_part_card_by_brand_article")
    @patch("app.services.search_resolve_service.find_indexable_used_catalog_product", return_value=None)
    def test_new_part_card_redirect(self, _mock_used, mock_find_card):
        card = MagicMock(id=42, brand="MANN", article="IF1009")
        mock_find_card.return_value = card
        db = MagicMock()

        result = resolve_search_query(db, "MANN IF1009", site_origin="https://svoygarage.ru")

        self.assertEqual(result.status, "redirect")
        self.assertEqual(result.redirect_path, "/autoparts/new/part/42-MANN-IF1009")
        self.assertEqual(result.match_type, "new_part_card")

    @patch("app.services.search_resolve_service.find_active_new_part_card_by_brand_article", return_value=None)
    @patch("app.services.search_resolve_service.find_indexable_used_catalog_product", return_value=None)
    def test_fallback_to_used_listing(self, _mock_used, _mock_card):
        db = MagicMock()

        result = resolve_search_query(db, "тормозные", site_origin="https://svoygarage.ru")

        self.assertEqual(result.status, "fallback")
        self.assertEqual(result.redirect_path, "/autoparts/used?q=%D1%82%D0%BE%D1%80%D0%BC%D0%BE%D0%B7%D0%BD%D1%8B%D0%B5")
        self.assertEqual(result.match_type, "listing")

    def test_empty_query_redirects_to_used_catalog(self):
        db = MagicMock()

        result = resolve_search_query(db, "   ", site_origin="https://svoygarage.ru")

        self.assertEqual(result.status, "fallback")
        self.assertEqual(result.redirect_path, "/autoparts/used")
        self.assertEqual(result.redirect_url, "https://svoygarage.ru/autoparts/used")


if __name__ == "__main__":
    unittest.main()
