import unittest
from unittest.mock import MagicMock

from app.utils.product_urls import (
    build_product_page_url,
    build_product_used_catalog_search_query,
    build_product_used_catalog_url,
)


class ProductUrlsTests(unittest.TestCase):
    def _product(self, **kwargs):
        product = MagicMock()
        product.id = kwargs.get("id", 1)
        product.brand = kwargs.get("brand", "BOSCH")
        product.article = kwargs.get("article", "A123")
        product.name = kwargs.get("name", "Part")
        return product

    def test_build_product_used_catalog_search_query_with_brand_and_article(self):
        product = self._product(brand="MANN-FILTER", article="IF1009")
        self.assertEqual(build_product_used_catalog_search_query(product), "MANN-FILTER IF1009")

    def test_build_product_used_catalog_search_query_article_only(self):
        product = self._product(brand="", article="24410-3E500")
        self.assertEqual(build_product_used_catalog_search_query(product), "24410-3E500")

    def test_build_product_used_catalog_url_encodes_query(self):
        product = self._product(brand="Hyundai/Kia", article="21020-26425")
        url = build_product_used_catalog_url(product, "https://svoygarage.ru")
        self.assertEqual(
            url,
            "https://svoygarage.ru/autoparts/used?q=Hyundai%2FKia%2021020-26425",
        )

    def test_build_product_page_url_unchanged(self):
        product = self._product(id=16, brand="BOSCH", article="A123")
        self.assertEqual(
            build_product_page_url(product, "https://svoygarage.ru"),
            "https://svoygarage.ru/part/16-BOSCH-A123",
        )


if __name__ == "__main__":
    unittest.main()
