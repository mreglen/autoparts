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
        self.assertIn("if1009", meta.canonical_url)

    def test_used_parts_search_seo(self):
        meta = get_static_page_seo_for_path(None, "/autoparts/used?q=24410-3E500")
        self.assertIsNotNone(meta)
        self.assertIn("24410-3E500", meta.title)

    def test_about_seo(self):
        meta = get_static_page_seo_for_path(None, "/about")
        self.assertIsNotNone(meta)
        self.assertIn("О компании", meta.title)

    def test_unknown_path_returns_none(self):
        self.assertIsNone(get_static_page_seo_for_path(None, "/dashboard"))

    def test_prerender_html_has_no_noindex(self):
        meta = get_static_page_seo_for_path(None, "/catalog")
        html = render_static_page_prerender_html(meta)
        self.assertIn("index, follow", html)
        self.assertNotIn("noindex", html)
        self.assertIn(meta.title.replace("&", "&amp;") if "&" in meta.title else meta.title, html)

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
