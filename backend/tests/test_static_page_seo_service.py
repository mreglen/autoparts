import unittest
from unittest.mock import MagicMock, patch

from app.services.static_page_seo_service import (
    get_seller_part_card_redirect_url,
    get_static_page_seo_for_path,
    render_static_page_prerender_html,
)


class StaticPageSeoTests(unittest.TestCase):
    def test_home_seo(self):
        meta = get_static_page_seo_for_path(None, "/")
        self.assertIsNotNone(meta)
        self.assertIn("Свой Гараж", meta.title)
        self.assertEqual(meta.canonical_url, "https://svoygarage.ru/")
        self.assertEqual(meta.robots, "index, follow")

    def test_catalog_seo(self):
        meta = get_static_page_seo_for_path(None, "/catalog")
        self.assertIsNotNone(meta)
        self.assertIn("Каталог", meta.title)
        self.assertEqual(meta.canonical_url, "https://svoygarage.ru/catalog")

    def test_new_parts_search_seo(self):
        meta = get_static_page_seo_for_path(None, "/autoparts/new?q=if1009")
        self.assertIsNotNone(meta)
        self.assertIn("if1009", meta.title)
        self.assertEqual(meta.canonical_url, "https://svoygarage.ru/autoparts/new")
        self.assertEqual(meta.robots, "noindex, follow")
        self.assertEqual(meta.keywords, "")
        html = render_static_page_prerender_html(meta)
        self.assertNotIn('name="keywords"', html)

    def test_used_parts_search_seo_without_db_stays_noindex(self):
        meta = get_static_page_seo_for_path(None, "/autoparts/used?q=24410-3E500")
        self.assertIsNotNone(meta)
        self.assertIn("24410-3E500", meta.title)
        self.assertEqual(meta.canonical_url, "https://svoygarage.ru/autoparts/used")
        self.assertEqual(meta.robots, "noindex, follow")
        self.assertEqual(meta.keywords, "")
        html = render_static_page_prerender_html(meta)
        self.assertNotIn('name="keywords"', html)

    @patch("app.services.static_page_seo_service.build_product_page_url")
    @patch("app.services.static_page_seo_service.build_product_used_catalog_url")
    @patch("app.services.used_catalog_service.find_indexable_used_catalog_product")
    def test_used_parts_canonical_product_query_is_indexable(
        self,
        mock_find_product,
        mock_used_url,
        mock_part_url,
    ):
        product = MagicMock(
            id=42,
            brand="BOSCH",
            article="A123",
            name="Filter",
            is_new=False,
        )
        mock_find_product.return_value = (product, "canonical")
        mock_used_url.return_value = "https://svoygarage.ru/autoparts/used?q=BOSCH%20A123"
        mock_part_url.return_value = "https://svoygarage.ru/part/42-BOSCH-A123"

        db = MagicMock()
        meta = get_static_page_seo_for_path(db, "/autoparts/used?q=BOSCH%20A123")

        self.assertIsNotNone(meta)
        self.assertEqual(meta.robots, "index, follow")
        self.assertEqual(meta.canonical_url, "https://svoygarage.ru/autoparts/used?q=BOSCH%20A123")
        self.assertIn("BOSCH", meta.title)
        self.assertTrue(meta.keywords)
        html = render_static_page_prerender_html(meta)
        self.assertIn("BOSCH", html)
        self.assertIn('name="keywords"', html)

    @patch("app.services.static_page_seo_service.build_product_page_url")
    @patch("app.services.static_page_seo_service.build_product_used_catalog_url")
    @patch("app.services.used_catalog_service.find_indexable_used_catalog_product")
    def test_used_parts_article_query_is_indexable_with_product_canonical(
        self,
        mock_find_product,
        mock_used_url,
        mock_part_url,
    ):
        product = MagicMock(
            id=16,
            brand="MANN",
            article="IF1009",
            name="Масляный фильтр",
            is_new=False,
        )
        mock_find_product.return_value = (product, "article")
        mock_used_url.return_value = "https://svoygarage.ru/autoparts/used?q=MANN%20IF1009"
        mock_part_url.return_value = "https://svoygarage.ru/part/16-MANN-IF1009"

        db = MagicMock()
        meta = get_static_page_seo_for_path(db, "/autoparts/used?q=IF1009")

        self.assertIsNotNone(meta)
        self.assertEqual(meta.robots, "index, follow")
        self.assertEqual(meta.canonical_url, "https://svoygarage.ru/autoparts/used?q=MANN%20IF1009")
        self.assertIn("IF1009", meta.title)

    def test_used_parts_single_brand_canonical_to_landing(self):
        meta = get_static_page_seo_for_path(None, "/autoparts/used?brand=BOSCH")
        self.assertIsNotNone(meta)
        self.assertEqual(meta.canonical_url, "https://svoygarage.ru/autoparts/used/brand/bosch")
        self.assertEqual(meta.robots, "noindex, follow")

    def test_new_parts_single_brand_canonical_to_landing(self):
        meta = get_static_page_seo_for_path(None, "/autoparts/new?brand=MANN-FILTER")
        self.assertIsNotNone(meta)
        self.assertEqual(meta.canonical_url, "https://svoygarage.ru/autoparts/new/brand/mann-filter")
        self.assertEqual(meta.robots, "noindex, follow")

    def test_about_seo(self):
        meta = get_static_page_seo_for_path(None, "/about")
        self.assertIsNotNone(meta)
        self.assertIn("О компании", meta.title)

    def test_unknown_path_returns_none(self):
        self.assertIsNone(get_static_page_seo_for_path(None, "/dashboard"))

    @patch("app.services.new_parts_seo_card_service.iter_new_part_cards_by_brand_for_prerender")
    @patch("app.services.new_parts_seo_card_service.count_new_part_cards_by_brand")
    @patch("app.services.seo_landing_page_service.resolve_brand_new_landing")
    def test_brand_landing_seo(self, mock_resolve, mock_count, mock_iter):
        from app.schemas.seo_landing_page import SeoLandingResolveOut

        mock_resolve.side_effect = [
            SeoLandingResolveOut(
                kind="brand_new",
                slug="bosch",
                title_ru="BOSCH",
                brand_name="BOSCH",
                meta_title="Новые запчасти BOSCH — каталог с доставкой | Свой Гараж",
                meta_description="Купить новые автозапчасти BOSCH: 2 позиций в каталоге, артикулы, цены, доставка по России.",
                filters={"brand": "BOSCH"},
                canonical_path="/autoparts/new/brand/bosch",
            ),
            SeoLandingResolveOut(
                kind="brand_new",
                slug="bosch",
                title_ru="BOSCH",
                brand_name="BOSCH",
                meta_title="Новые запчасти BOSCH — каталог с доставкой | Свой Гараж",
                meta_description="Купить новые автозапчасти BOSCH: 2 позиций в каталоге, артикулы, цены, доставка по России.",
                filters={"brand": "BOSCH"},
                canonical_path="/autoparts/new/brand/bosch",
            ),
        ]
        mock_count.return_value = 2
        card = MagicMock(id=1, brand="BOSCH", article="A1", name="Part")
        mock_iter.return_value = [card]

        db = MagicMock()
        meta = get_static_page_seo_for_path(db, "/autoparts/new/brand/bosch")
        self.assertIsNotNone(meta)
        self.assertEqual(meta.h1, "Новые автозапчасти BOSCH")
        self.assertEqual(meta.canonical_url, "https://svoygarage.ru/autoparts/new/brand/bosch")
        self.assertTrue(meta.keywords)
        html = render_static_page_prerender_html(meta)
        self.assertIn("BOSCH A1", html)
        self.assertIn("<ul>", html)
        self.assertIn('name="keywords"', html)

    @patch("app.services.new_parts_seo_card_service.iter_new_part_cards_by_category_for_prerender")
    @patch("app.services.new_parts_seo_card_service.count_new_part_cards_by_category_slug")
    @patch("app.services.seo_landing_page_service.resolve_category_new_landing")
    def test_category_landing_seo(self, mock_resolve, mock_count, mock_iter):
        from app.schemas.seo_landing_page import SeoLandingResolveOut

        mock_resolve.side_effect = [
            SeoLandingResolveOut(
                kind="category_new",
                slug="tormoznye-kolodki",
                title_ru="Тормозные колодки",
                search_query="тормозные колодки",
                meta_title="Новые Тормозные колодки — купить с доставкой | Свой Гараж",
                meta_description="Каталог новых тормозных колодок: 2 позиций, цены, артикулы, аналоги. Доставка по России.",
                filters={"search_query": "тормозные колодки", "category_slug": "tormoznye-kolodki"},
                canonical_path="/autoparts/new/category/tormoznye-kolodki",
            ),
            SeoLandingResolveOut(
                kind="category_new",
                slug="tormoznye-kolodki",
                title_ru="Тормозные колодки",
                search_query="тормозные колодки",
                meta_title="Новые Тормозные колодки — купить с доставкой | Свой Гараж",
                meta_description="Каталог новых тормозных колодок: 2 позиций, цены, артикулы, аналоги. Доставка по России.",
                filters={"search_query": "тормозные колодки", "category_slug": "tormoznye-kolodki"},
                canonical_path="/autoparts/new/category/tormoznye-kolodki",
            ),
        ]
        mock_count.return_value = 2
        card = MagicMock(id=1, brand="BOSCH", article="BP123", name="Тормозные колодки")
        mock_iter.return_value = [card]

        db = MagicMock()
        meta = get_static_page_seo_for_path(db, "/autoparts/new/category/tormoznye-kolodki")
        self.assertIsNotNone(meta)
        self.assertEqual(meta.h1, "Новые Тормозные колодки — каталог с доставкой")
        self.assertEqual(
            meta.canonical_url,
            "https://svoygarage.ru/autoparts/new/category/tormoznye-kolodki",
        )
        html = render_static_page_prerender_html(meta)
        self.assertIn("BOSCH BP123", html)

    @patch("app.services.used_catalog_service.iter_used_products_by_brand_for_prerender")
    @patch("app.services.used_catalog_service.count_used_products_by_brand")
    @patch("app.services.seo_landing_page_service.resolve_brand_used_landing")
    def test_used_brand_landing_seo(self, mock_resolve, mock_count, mock_iter):
        from app.schemas.seo_landing_page import SeoLandingResolveOut

        mock_resolve.side_effect = [
            SeoLandingResolveOut(
                kind="brand_used",
                slug="bosch",
                title_ru="BOSCH",
                brand_name="BOSCH",
                meta_title="Б/у запчасти BOSCH — каталог продавцов | Свой Гараж",
                meta_description="2 б/у автозапчастей BOSCH от продавцов на «Свой Гараж».",
                filters={"brand": "BOSCH"},
                canonical_path="/autoparts/used/brand/bosch",
            ),
            SeoLandingResolveOut(
                kind="brand_used",
                slug="bosch",
                title_ru="BOSCH",
                brand_name="BOSCH",
                meta_title="Б/у запчасти BOSCH — каталог продавцов | Свой Гараж",
                meta_description="2 б/у автозапчастей BOSCH от продавцов на «Свой Гараж».",
                filters={"brand": "BOSCH"},
                canonical_path="/autoparts/used/brand/bosch",
            ),
        ]
        mock_count.return_value = 2
        product = MagicMock(id=10, brand="BOSCH", article="A1", name="Part")
        mock_iter.return_value = [product]

        db = MagicMock()
        meta = get_static_page_seo_for_path(db, "/autoparts/used/brand/bosch")
        self.assertIsNotNone(meta)
        self.assertEqual(meta.h1, "Б/у автозапчасти BOSCH")
        self.assertEqual(meta.canonical_url, "https://svoygarage.ru/autoparts/used/brand/bosch")
        self.assertTrue(meta.keywords)
        html = render_static_page_prerender_html(meta)
        self.assertIn('name="keywords"', html)
        self.assertIn("Частые вопросы", html)
        self.assertIn("FAQPage", html)

    def test_prerender_html_has_no_noindex(self):
        meta = get_static_page_seo_for_path(None, "/catalog")
        html = render_static_page_prerender_html(meta)
        self.assertIn("index, follow", html)
        self.assertNotIn("noindex", html)
        self.assertIn(meta.title.replace("&", "&amp;") if "&" in meta.title else meta.title, html)

    def test_home_and_catalog_have_no_keywords(self):
        for path in ("/", "/catalog"):
            meta = get_static_page_seo_for_path(None, path)
            self.assertEqual(meta.keywords, "")
            html = render_static_page_prerender_html(meta)
            self.assertNotIn('name="keywords"', html)

    @patch("app.services.static_page_seo_service.build_product_page_url")
    def test_seller_part_card_redirect(self, mock_build_url):
        mock_build_url.return_value = "https://svoygarage.ru/part/16-brand-article"
        product = MagicMock(id=16, brand="Brand", article="Article", name="Part", quantity=1)
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = product

        url = get_seller_part_card_redirect_url(db, "/seller/part-card/16")
        self.assertEqual(url, "https://svoygarage.ru/part/16-brand-article")


if __name__ == "__main__":
    unittest.main()
