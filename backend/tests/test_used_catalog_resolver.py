import unittest
from unittest.mock import MagicMock, patch

from app.services.used_catalog_service import (
    find_indexable_used_catalog_product,
    find_working_product_by_used_catalog_query,
)


class FindIndexableUsedCatalogProductTests(unittest.TestCase):
    def _working_product(self, *, pid: int, brand: str, article: str, name: str | None = None):
        photo = MagicMock()
        photo.photo_url = "https://cdn.example/photo.jpg"
        product = MagicMock()
        product.id = pid
        product.quantity = 1
        product.brand = brand
        product.article = article
        product.name = name or f"Part {pid}"
        product.photos = [photo]
        return product

    def _mock_db(self, filter_results: list[list]):
        pending = list(filter_results)

        def filter_side_effect(*_args, **_kwargs):
            match_query = MagicMock()
            if pending:
                match_query.all.return_value = pending.pop(0)
            else:
                match_query.all.return_value = []
            return match_query

        working_base = MagicMock()
        working_base.filter.side_effect = filter_side_effect

        db = MagicMock()
        db.query.return_value.options.return_value.filter.return_value = working_base
        return db

    @patch("app.services.used_catalog_service.selectinload")
    @patch("app.services.sitemap_service.is_working_catalog_product", return_value=True)
    def test_canonical_match_case_insensitive(self, _is_working, _selectinload):
        product = self._working_product(pid=1, brand="BOSCH", article="A123")
        db = self._mock_db([[product]])

        result = find_indexable_used_catalog_product(db, "bosch a123")

        self.assertEqual(result, (product, "canonical"))
        db2 = self._mock_db([[product]])
        self.assertIs(find_working_product_by_used_catalog_query(db2, "bosch a123"), product)

    @patch("app.services.used_catalog_service.selectinload")
    @patch("app.services.sitemap_service.is_working_catalog_product", return_value=True)
    def test_canonical_returns_none_when_multiple_matches(self, _is_working, _selectinload):
        first = self._working_product(pid=1, brand="BOSCH", article="A123")
        second = self._working_product(pid=2, brand="BOSCH", article="A123")
        db = self._mock_db([[first, second], [], []])

        self.assertIsNone(find_indexable_used_catalog_product(db, "BOSCH A123"))

    @patch("app.services.used_catalog_service.selectinload")
    @patch("app.services.sitemap_service.is_working_catalog_product", return_value=True)
    def test_article_unique_match(self, _is_working, _selectinload):
        product = self._working_product(pid=3, brand="MANN", article="IF-1009")
        db = self._mock_db([[], [product]])

        result = find_indexable_used_catalog_product(db, "IF1009")

        self.assertEqual(result, (product, "article"))

    @patch("app.services.used_catalog_service.selectinload")
    @patch("app.services.sitemap_service.is_working_catalog_product", return_value=True)
    def test_article_duplicate_returns_none(self, _is_working, _selectinload):
        first = self._working_product(pid=1, brand="MANN", article="IF1009")
        second = self._working_product(pid=2, brand="BOSCH", article="IF1009")
        db = self._mock_db([[], [first, second], []])

        self.assertIsNone(find_indexable_used_catalog_product(db, "IF1009"))

    @patch("app.services.used_catalog_service.selectinload")
    @patch("app.services.sitemap_service.is_working_catalog_product", return_value=True)
    def test_name_unique_match(self, _is_working, _selectinload):
        product = self._working_product(
            pid=4,
            brand="MANN",
            article="W712/75",
            name="Масляный фильтр MANN",
        )
        db = self._mock_db([[], [], [product]])

        result = find_indexable_used_catalog_product(db, "Масляный фильтр MANN")

        self.assertEqual(result, (product, "name"))

    @patch("app.services.used_catalog_service.selectinload")
    @patch("app.services.sitemap_service.is_working_catalog_product", return_value=True)
    def test_name_duplicate_returns_none(self, _is_working, _selectinload):
        first = self._working_product(pid=1, brand="A", article="X1", name="Одинаковое название")
        second = self._working_product(pid=2, brand="B", article="X2", name="Одинаковое название")
        db = self._mock_db([[], [], [first, second]])

        self.assertIsNone(find_indexable_used_catalog_product(db, "Одинаковое название"))

    def test_returns_none_for_empty_query(self):
        db = MagicMock()
        self.assertIsNone(find_indexable_used_catalog_product(db, "   "))
        self.assertIsNone(find_working_product_by_used_catalog_query(db, "   "))


if __name__ == "__main__":
    unittest.main()
