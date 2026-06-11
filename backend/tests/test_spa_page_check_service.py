import unittest
from unittest.mock import MagicMock, patch

from app.services.spa_page_check_service import (
    _normalize_path,
    is_spa_page_available,
    render_not_found_html,
)


class NormalizePathTests(unittest.TestCase):
    def test_strips_query_and_trailing_slash(self):
        self.assertEqual(_normalize_path("/catalog/?utm=1"), "/catalog")
        self.assertEqual(_normalize_path("catalog"), "/catalog")


class SpaRouteMatchingTests(unittest.TestCase):
    def test_known_public_routes_allowed_without_db(self):
        db = MagicMock()
        for path in (
            "/",
            "/catalog",
            "/autoparts/new",
            "/about",
            "/privacy",
            "/cart/new/checkout",
        ):
            self.assertTrue(is_spa_page_available(db, path), path)

    def test_unknown_nested_routes_rejected(self):
        db = MagicMock()
        for path in (
            "/catalog/missing",
            "/about/foo",
            "/settings",
            "/admin",
            "/moderation",
            "/part/",
            "/wp-login.php",
            "/missing-page",
        ):
            self.assertFalse(is_spa_page_available(db, path), path)

    def test_unknown_brand_landing_rejected(self):
        db = MagicMock()
        with patch(
            "app.services.seo_landing_page_service.resolve_brand_new_landing",
            return_value=None,
        ):
            self.assertFalse(is_spa_page_available(db, "/autoparts/new/brand/missing"))

    @patch("app.services.seo_landing_page_service.resolve_brand_new_landing")
    def test_valid_brand_landing(self, mock_resolve):
        mock_resolve.return_value = object()
        db = MagicMock()
        self.assertTrue(is_spa_page_available(db, "/autoparts/new/brand/bosch"))

    def test_unknown_category_landing_rejected(self):
        db = MagicMock()
        with patch(
            "app.services.seo_landing_page_service.resolve_category_new_landing",
            return_value=None,
        ):
            self.assertFalse(is_spa_page_available(db, "/autoparts/new/category/missing"))

    @patch("app.services.seo_landing_page_service.resolve_category_new_landing")
    def test_valid_category_landing(self, mock_resolve):
        mock_resolve.return_value = object()
        db = MagicMock()
        self.assertTrue(is_spa_page_available(db, "/autoparts/new/category/tormoznye-kolodki"))

    @patch("app.services.seo_landing_page_service.resolve_brand_used_landing")
    def test_valid_used_brand_landing(self, mock_resolve):
        mock_resolve.return_value = object()
        db = MagicMock()
        self.assertTrue(is_spa_page_available(db, "/autoparts/used/brand/bosch"))

    @patch("app.services.seo_landing_page_service.resolve_category_used_landing")
    def test_valid_used_category_landing(self, mock_resolve):
        mock_resolve.return_value = object()
        db = MagicMock()
        self.assertTrue(is_spa_page_available(db, "/autoparts/used/category/tormoznye-kolodki"))

    @patch("app.services.seo_landing_page_service.resolve_geo_landing")
    def test_valid_geo_landing(self, mock_resolve):
        mock_resolve.return_value = object()
        db = MagicMock()
        self.assertTrue(is_spa_page_available(db, "/autoparts/used/geo/ekaterinburg"))

    @patch("app.services.spa_page_check_service._product_exists", return_value=False)
    def test_missing_product_returns_false(self, _exists):
        db = MagicMock()
        self.assertFalse(is_spa_page_available(db, "/part/999999-brand-article"))

    @patch("app.services.spa_page_check_service._product_exists", return_value=True)
    def test_existing_product_returns_true(self, _exists):
        db = MagicMock()
        self.assertTrue(is_spa_page_available(db, "/part/42-brand-article"))


class NotFoundHtmlTests(unittest.TestCase):
    def test_contains_noindex_and_title(self):
        html = render_not_found_html()
        self.assertIn("noindex, nofollow", html)
        self.assertIn("404", html)


if __name__ == "__main__":
    unittest.main()
