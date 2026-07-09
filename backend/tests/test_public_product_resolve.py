import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from app.routers.products import resolve_public_product


class PublicProductResolveTests(unittest.TestCase):
    @patch("app.services.product_seo_service._load_product")
    @patch("app.utils.product_urls.build_product_page_url")
    def test_resolve_returns_sold_out_product(self, mock_build_url, mock_load_product):
        product = MagicMock(id=42, brand="Bosch", article="ABC123", quantity=0)
        mock_load_product.return_value = product
        mock_build_url.return_value = "/part/42-Bosch-ABC123"
        db = MagicMock()

        result = resolve_public_product(42, db=db)

        mock_load_product.assert_called_once_with(db, 42, require_stock=False)
        self.assertEqual(result.id, 42)
        self.assertEqual(result.brand, "Bosch")
        self.assertEqual(result.article, "ABC123")
        self.assertEqual(result.quantity, 0)
        self.assertFalse(result.in_stock)
        self.assertEqual(result.path, "/part/42-Bosch-ABC123")

    @patch("app.services.product_seo_service._load_product")
    @patch("app.utils.product_urls.build_product_page_url")
    def test_resolve_returns_in_stock_product(self, mock_build_url, mock_load_product):
        product = MagicMock(id=7, brand="Brand", article="Art", quantity=3)
        mock_load_product.return_value = product
        mock_build_url.return_value = "/part/7-Brand-Art"
        db = MagicMock()

        result = resolve_public_product(7, db=db)

        self.assertTrue(result.in_stock)
        self.assertEqual(result.quantity, 3)

    @patch("app.services.product_seo_service._load_product")
    def test_resolve_404_for_missing_product(self, mock_load_product):
        mock_load_product.return_value = None
        db = MagicMock()

        with self.assertRaises(HTTPException) as ctx:
            resolve_public_product(999, db=db)

        self.assertEqual(ctx.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
