import json
import unittest
from unittest.mock import MagicMock

from app.services.product_seo_service import build_product_seo_meta, render_product_prerender_html
from app.utils.product_search_seo import (
    build_product_alternate_names,
    build_product_offer_json_ld,
    build_product_search_description,
    build_product_search_title,
)


class ProductSearchTitleTests(unittest.TestCase):
    def test_brand_and_article_title(self):
        title = build_product_search_title(brand="MANN", article="IF1009")
        self.assertEqual(title, "MANN IF1009 | Свой Гараж")
        self.assertTrue(title.startswith("MANN"))
        self.assertIn("IF1009", title)
        self.assertIn("Свой Гараж", title)

    def test_brand_article_and_name_title(self):
        title = build_product_search_title(
            brand="KRAFT",
            article="KT 100529",
            fallback_display_name="KRAFT KT 100529 Подшипник сцепления ВАЗ 2110-2115",
        )
        self.assertEqual(
            title,
            "KRAFT KT 100529 Подшипник сцепления ВАЗ 2110-2115 | Свой Гараж",
        )

    def test_article_only_title(self):
        title = build_product_search_title(brand="", article="24410-3E500")
        self.assertEqual(title, "24410-3E500 | Свой Гараж")

    def test_fallback_title(self):
        title = build_product_search_title(
            brand="",
            article="",
            fallback_display_name="MANN IF1009 Фильтр",
        )
        self.assertEqual(title, "MANN IF1009 Фильтр | Свой Гараж")


class ProductSearchDescriptionTests(unittest.TestCase):
    def test_description_contains_city_price_and_delivery(self):
        description = build_product_search_description(
            brand="MANN",
            article="IF1009",
            is_new=True,
            city="Екатеринбург",
            price=1200,
            short_name="Масляный фильтр",
        )
        self.assertIn("Купить MANN IF1009.", description)
        self.assertIn("Новая запчасть в наличии в Екатеринбурге.", description)
        self.assertIn("1 200 ₽.", description)
        self.assertIn("Доставка по России.", description)
        self.assertIn("Масляный фильтр", description)
        self.assertLessEqual(len(description), 160)

    def test_description_includes_product_text_snippet(self):
        long_desc = "Оригинальный фильтр в отличном состоянии, без повреждений, проверен на складе."
        description = build_product_search_description(
            brand="MANN",
            article="IF1009",
            is_new=False,
            city="Екатеринбург",
            price=850,
            unique_description=long_desc,
        )
        self.assertTrue(description.startswith("Купить MANN IF1009."))
        self.assertIn("в Екатеринбурге.", description)
        self.assertIn("850 ₽.", description)
        self.assertIn("Оригинальный фильтр", description)


class ProductAlternateNamesTests(unittest.TestCase):
    def test_alternate_names_variants(self):
        names = build_product_alternate_names(brand="MANN", article="IF1009")
        self.assertEqual(names, ["IF1009", "MANN IF1009", "IF1009 MANN"])


class ProductOfferJsonLdTests(unittest.TestCase):
    def test_offer_contains_seller_shipping_and_city(self):
        offer = build_product_offer_json_ld(
            canonical_url="https://svoygarage.ru/part/16-MANN-IF1009",
            price="1200.00",
            in_stock=True,
            is_new=False,
            seller_name="Авторазбор",
            seller_phone="+79990000000",
            seller_address="620907, г. Екатеринбург, ул. Фруктовая, 17",
            city="Екатеринбург",
        )
        self.assertIsNotNone(offer)
        self.assertEqual(offer["seller"]["name"], "Авторазбор")
        self.assertEqual(offer["areaServed"]["name"], "RU")
        self.assertIn("shippingDetails", offer)
        self.assertEqual(offer["availableAtOrFrom"]["address"]["addressLocality"], "Екатеринбург")


class ProductSeoMetaIntegrationTests(unittest.TestCase):
    def _make_product(self):
        product = MagicMock()
        product.brand = "MANN"
        product.article = "IF1009"
        product.name = "MANN / IF1009 Масляный фильтр"
        product.description = "Оригинальный фильтр в отличном состоянии."
        product.is_new = True
        product.price = 1200
        product.quantity = 2
        product.photos = []
        product.id = 16
        product.organization = MagicMock(
            name="Авторазбор",
            phone="+79990000000",
            address="620907, г. Екатеринбург, ул. Фруктовая, 17",
        )
        return product

    def test_build_product_seo_meta_uses_search_templates(self):
        meta = build_product_seo_meta(self._make_product(), site_origin="https://svoygarage.ru")
        self.assertEqual(meta.title, "MANN IF1009 Масляный фильтр | Свой Гараж")
        self.assertIn("Купить MANN IF1009.", meta.description)
        self.assertIn("в Екатеринбурге.", meta.description)
        self.assertIn("1 200 ₽.", meta.description)
        self.assertIn("Доставка по России.", meta.description)

        json_ld = json.loads(meta.json_ld)
        self.assertEqual(json_ld["sku"], "IF1009")
        self.assertEqual(json_ld["mpn"], "IF1009")
        self.assertEqual(json_ld["alternateName"], ["IF1009", "MANN IF1009", "IF1009 MANN"])
        self.assertEqual(json_ld["description"], meta.description)
        self.assertIn("seller", json_ld["offers"])
        self.assertIn("shippingDetails", json_ld["offers"])

    def test_prerender_html_includes_json_ld_product(self):
        meta = build_product_seo_meta(self._make_product(), site_origin="https://svoygarage.ru")
        html = render_product_prerender_html(meta)
        self.assertIn('type="application/ld+json"', html)
        self.assertIn('"@type": "Product"', html)
        self.assertIn('"@type": "BreadcrumbList"', html)

    def test_prerender_html_has_no_noindex(self):
        meta = build_product_seo_meta(self._make_product(), site_origin="https://svoygarage.ru")
        html = render_product_prerender_html(meta)
        self.assertIn("MANN IF1009 Масляный фильтр", html)
        self.assertIn("в Екатеринбурге.", html)
        self.assertIn("Оригинальный фильтр в отличном состоянии.", html)
        self.assertNotIn("noindex", html)
        self.assertNotIn("Открыть карточку", html)
        self.assertNotIn("Цена:", html)

    def test_prerender_html_includes_og_image(self):
        meta = build_product_seo_meta(self._make_product(), site_origin="https://svoygarage.ru")
        html = render_product_prerender_html(meta)
        self.assertIn('property="og:image"', html)
        self.assertIsNotNone(meta.image_url)
        self.assertIn(meta.image_url, html)

    def test_prerender_html_og_image_fallback_without_photos(self):
        product = self._make_product()
        product.photos = []
        meta = build_product_seo_meta(product, site_origin="https://svoygarage.ru")
        html = render_product_prerender_html(meta)
        self.assertIn('property="og:image"', html)
        self.assertIn("/favicons/apple-touch-icon.png", html)


if __name__ == "__main__":
    unittest.main()
