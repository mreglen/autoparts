import unittest
from unittest.mock import MagicMock, patch

from app.services.used_catalog_service import find_working_product_by_used_catalog_query


class FindWorkingProductByUsedCatalogQueryTests(unittest.TestCase):
    def _working_product(self, *, pid: int, brand: str, article: str):
        photo = MagicMock()
        photo.photo_url = "https://cdn.example/photo.jpg"
        product = MagicMock()
        product.id = pid
        product.quantity = 1
        product.brand = brand
        product.article = article
        product.name = f"Part {pid}"
        product.photos = [photo]
        return product

    @patch("app.services.used_catalog_service.selectinload")
    @patch("app.services.sitemap_service.is_working_catalog_product", return_value=True)
    def test_returns_single_match_case_insensitive(self, _is_working, _selectinload):
        product = self._working_product(pid=1, brand="BOSCH", article="A123")
        db = MagicMock()
        db.query.return_value.options.return_value.filter.return_value.all.return_value = [product]

        result = find_working_product_by_used_catalog_query(db, "bosch a123")

        self.assertIs(result, product)

    @patch("app.services.used_catalog_service.selectinload")
    @patch("app.services.sitemap_service.is_working_catalog_product", return_value=True)
    def test_returns_none_when_multiple_matches(self, _is_working, _selectinload):
        first = self._working_product(pid=1, brand="BOSCH", article="A123")
        second = self._working_product(pid=2, brand="BOSCH", article="A123")
        db = MagicMock()
        db.query.return_value.options.return_value.filter.return_value.all.return_value = [
            first,
            second,
        ]

        result = find_working_product_by_used_catalog_query(db, "BOSCH A123")

        self.assertIsNone(result)

    def test_returns_none_for_empty_query(self):
        db = MagicMock()
        self.assertIsNone(find_working_product_by_used_catalog_query(db, "   "))


if __name__ == "__main__":
    unittest.main()
