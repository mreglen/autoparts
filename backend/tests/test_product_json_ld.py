import json
import unittest
from unittest.mock import MagicMock

from app.services.new_parts_seo_card_service import build_new_part_seo_meta, render_new_part_prerender_html
from app.services.product_seo_service import build_product_seo_meta, render_product_prerender_html
from app.utils.product_json_ld import (
    build_catalog_product_json_ld,
    build_new_part_card_json_ld,
    format_price_ld,
    is_catalog_product_json_ld_eligible,
    is_new_part_json_ld_eligible,
    product_body_description,
    split_graph_json_ld_for_yandex,
)


class FormatPriceLdTests(unittest.TestCase):
    def test_valid_price(self):
        self.assertEqual(format_price_ld(1200), "1200.00")
        self.assertEqual(format_price_ld("850.5"), "850.50")

    def test_invalid_price(self):
        self.assertIsNone(format_price_ld(None))
        self.assertIsNone(format_price_ld(0))
        self.assertIsNone(format_price_ld(-10))


class ProductBodyDescriptionTests(unittest.TestCase):
    def test_prefers_unique_description(self):
        text = product_body_description(
            brand="MANN",
            article="IF1009",
            name="MANN IF1009 Масляный фильтр",
            unique_description="Оригинальный фильтр в отличном состоянии, без повреждений.",
        )
        self.assertIn("Оригинальный фильтр", text)


class CatalogProductJsonLdTests(unittest.TestCase):
    def _make_product(self, *, photos=None, price=1200, quantity=2):
        product = MagicMock()
        product.brand = "MANN"
        product.article = "IF1009"
        product.name = "MANN / IF1009 Масляный фильтр"
        product.description = "Оригинальный фильтр в отличном состоянии."
        product.is_new = False
        product.price = price
        product.quantity = quantity
        photo = MagicMock()
        photo.photo_url = "/uploads/pictures/test.jpg"
        product.photos = photos if photos is not None else [photo]
        product.organization = MagicMock(
            name="Авторазбор",
            phone="+79990000000",
            address="620907, г. Екатеринбург, ул. Фруктовая, 17",
        )
        return product

    def test_eligible_product_has_required_fields(self):
        product = self._make_product()
        self.assertTrue(is_catalog_product_json_ld_eligible(product))
        json_ld = build_catalog_product_json_ld(
            product,
            site_origin="https://svoygarage.ru",
            canonical_url="https://svoygarage.ru/part/16-MANN-IF1009",
        )
        self.assertIsNotNone(json_ld)
        self.assertEqual(json_ld["name"], "MANN IF1009 Масляный фильтр")
        self.assertEqual(json_ld["brand"]["name"], "MANN")
        self.assertEqual(json_ld["manufacturer"]["name"], "MANN")
        self.assertTrue(json_ld["image"])
        self.assertEqual(json_ld["offers"]["priceCurrency"], "RUB")
        self.assertEqual(json_ld["offers"]["price"], "1200.00")
        self.assertIn("availability", json_ld["offers"])

    def test_no_price_means_not_eligible(self):
        product = self._make_product(price=0)
        self.assertFalse(is_catalog_product_json_ld_eligible(product))
        self.assertIsNone(
            build_catalog_product_json_ld(
                product,
                site_origin="https://svoygarage.ru",
                canonical_url="https://svoygarage.ru/part/16-MANN-IF1009",
            )
        )

    def test_no_photo_uses_logo_placeholder(self):
        product = self._make_product(photos=[])
        self.assertTrue(is_catalog_product_json_ld_eligible(product))
        json_ld = build_catalog_product_json_ld(
            product,
            site_origin="https://svoygarage.ru",
            canonical_url="https://svoygarage.ru/part/16-MANN-IF1009",
        )
        self.assertIsNotNone(json_ld)
        self.assertEqual(
            json_ld["image"],
            ["https://svoygarage.ru/img/product-placeholder-white.png"],
        )


class NewPartJsonLdTests(unittest.TestCase):
    def _make_card(self, *, price=1200, stock_count=3, image_url="/uploads/new/test.jpg"):
        card = MagicMock()
        card.brand = "MANN"
        card.article = "IF1009"
        card.name = "MANN IF1009 Масляный фильтр"
        card.description = "Новая запчасть MANN IF1009."
        card.price = price
        card.stock_count = stock_count
        card.image_url = image_url
        card.id = 42
        return card

    def test_new_part_card_has_image_and_manufacturer(self):
        card = self._make_card()
        self.assertTrue(is_new_part_json_ld_eligible(card))
        json_ld = build_new_part_card_json_ld(
            card,
            site_origin="https://svoygarage.ru",
            canonical_url="https://svoygarage.ru/autoparts/new/part/42-MANN-IF1009",
        )
        self.assertIsNotNone(json_ld)
        self.assertEqual(json_ld["manufacturer"]["name"], "MANN")
        self.assertTrue(json_ld["image"])
        self.assertEqual(json_ld["offers"]["price"], "1200.00")

    def test_new_part_without_price_not_eligible(self):
        card = self._make_card(price=None)
        self.assertFalse(is_new_part_json_ld_eligible(card))


class ProductSeoServiceJsonLdIntegrationTests(unittest.TestCase):
    def _make_product(self, *, photos=None):
        product = MagicMock()
        product.brand = "MANN"
        product.article = "IF1009"
        product.name = "MANN / IF1009 Масляный фильтр"
        product.description = "Оригинальный фильтр в отличном состоянии."
        product.is_new = True
        product.price = 1200
        product.quantity = 2
        product.id = 16
        photo = MagicMock()
        photo.photo_url = "/uploads/pictures/test.jpg"
        product.photos = photos if photos is not None else [photo]
        product.organization = MagicMock(
            name="Авторазбор",
            phone="+79990000000",
            address="620907, г. Екатеринбург, ул. Фруктовая, 17",
        )
        return product

    def test_build_product_seo_meta_json_ld_when_eligible(self):
        meta = build_product_seo_meta(self._make_product(), site_origin="https://svoygarage.ru")
        self.assertTrue(meta.json_ld)
        json_ld = json.loads(meta.json_ld)
        self.assertEqual(json_ld["@type"], "Product")
        self.assertEqual(json_ld["offers"]["price"], "1200.00")
        self.assertIn("manufacturer", json_ld)
        self.assertNotEqual(json_ld["description"], meta.description)

    def test_build_product_seo_meta_without_photo_uses_logo_placeholder(self):
        meta = build_product_seo_meta(self._make_product(photos=[]), site_origin="https://svoygarage.ru")
        self.assertTrue(meta.json_ld)
        json_ld = json.loads(meta.json_ld)
        self.assertEqual(json_ld["@type"], "Product")
        self.assertEqual(
            json_ld["image"],
            ["https://svoygarage.ru/img/product-placeholder-white.png"],
        )
        graph = json.loads(meta.json_ld_graph)
        types = {node["@type"] for node in graph["@graph"]}
        self.assertIn("Product", types)

    def test_prerender_html_contains_product_json_ld(self):
        meta = build_product_seo_meta(self._make_product(), site_origin="https://svoygarage.ru")
        html = render_product_prerender_html(meta)
        self.assertIn('type="application/ld+json"', html)
        self.assertIn('"@type": "Product"', html)
        self.assertNotIn('"@graph"', html)
        self.assertIn('itemscope itemtype="https://schema.org/Product"', html)
        self.assertIn('product:price:amount', html)
        self.assertIn("<img ", html)


class NewPartSeoServiceJsonLdIntegrationTests(unittest.TestCase):
    def _make_card(self):
        card = MagicMock()
        card.brand = "MANN"
        card.article = "IF1009"
        card.name = "MANN IF1009 Масляный фильтр"
        card.description = "Новая запчасть MANN IF1009."
        card.price = 1200
        card.stock_count = 2
        card.image_url = "/uploads/new/test.jpg"
        card.id = 42
        card.currency = "RUB"
        return card

    def test_build_new_part_seo_meta_json_ld(self):
        meta = build_new_part_seo_meta(self._make_card(), site_origin="https://svoygarage.ru", markup_percent=15)
        self.assertTrue(meta.json_ld)
        json_ld = json.loads(meta.json_ld)
        self.assertEqual(json_ld["@type"], "Product")
        self.assertEqual(json_ld["url"], meta.canonical_url)
        self.assertEqual(json_ld["@id"], f"{meta.canonical_url}#product")
        self.assertIn("image", json_ld)
        self.assertEqual(json_ld["offers"]["priceCurrency"], "RUB")
        self.assertEqual(json_ld["sku"], "IF1009")
        self.assertEqual(json_ld["mpn"], "IF1009")
        self.assertIn("alternateName", json_ld)
        self.assertIn("shippingDetails", json_ld["offers"])

    def test_build_new_part_seo_meta_title_description_use_base_price(self):
        meta = build_new_part_seo_meta(self._make_card(), site_origin="https://svoygarage.ru", markup_percent=15)
        self.assertIn("от 1 200 ₽", meta.title)
        self.assertNotIn("1 380", meta.title)
        self.assertIn("1 200 ₽.", meta.description)
        self.assertNotIn("1 380", meta.description)
        json_ld = json.loads(meta.json_ld)
        self.assertEqual(json_ld["offers"]["price"], "1380.00")

    def test_build_new_part_seo_meta_json_ld_graph(self):
        meta = build_new_part_seo_meta(self._make_card(), site_origin="https://svoygarage.ru", markup_percent=15)
        self.assertTrue(meta.json_ld_graph)
        graph = json.loads(meta.json_ld_graph)
        self.assertIn("@graph", graph)
        types = {node["@type"] for node in graph["@graph"]}
        self.assertIn("Product", types)
        self.assertIn("BreadcrumbList", types)
        self.assertIn("WebPage", types)

    def test_new_part_prerender_html_contains_product_json_ld(self):
        meta = build_new_part_seo_meta(self._make_card(), site_origin="https://svoygarage.ru", markup_percent=15)
        html = render_new_part_prerender_html(meta)
        self.assertIn('type="application/ld+json"', html)
        self.assertNotIn('"@graph"', html)
        self.assertIn('"@type": "Product"', html)
        self.assertIn('itemscope itemtype="https://schema.org/Product"', html)
        self.assertIn('aria-label="Хлебные крошки"', html)
        self.assertIn("<img ", html)
        self.assertIn(meta.h1, html)


class SplitGraphJsonLdForYandexTests(unittest.TestCase):
    def test_splits_product_from_graph(self):
        product = {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "MANN IF1009",
            "offers": {"@type": "Offer", "price": "1200.00", "priceCurrency": "RUB"},
        }
        graph = {
            "@context": "https://schema.org",
            "@graph": [
                {**product, "@context": None},
                {"@type": "BreadcrumbList", "itemListElement": []},
            ],
        }
        blocks = split_graph_json_ld_for_yandex(
            product_json_ld=json.dumps(product),
            json_ld_graph=json.dumps(graph),
        )
        self.assertEqual(len(blocks), 2)
        first = json.loads(blocks[0])
        self.assertEqual(first["@type"], "Product")
        self.assertEqual(first["name"], "MANN IF1009")
        self.assertNotIn("@graph", first)


if __name__ == "__main__":
    unittest.main()
