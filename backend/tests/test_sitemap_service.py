import unittest
from datetime import date, datetime, timezone
from unittest.mock import MagicMock, patch

from app.services.sitemap_service import (
    NEW_PARTS_SITEMAP_CACHE_KEY,
    PRODUCTS_SITEMAP_CACHE_KEY,
    _product_lastmod_date,
    build_fallback_sitemap_index_xml,
    build_new_parts_sitemap_xml,
    build_products_sitemap_xml,
    build_sitemap_index_xml,
    get_products_sitemap_snapshot,
    is_sitemap_cache_stale,
    rebuild_new_parts_sitemap_cache,
    rebuild_products_sitemap_cache,
)


class ProductLastmodTests(unittest.TestCase):
    def test_uses_updated_at_in_utc(self):
        product = MagicMock()
        product.updated_at = datetime(2026, 3, 15, 22, 30, tzinfo=timezone.utc)
        product.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
        self.assertEqual(_product_lastmod_date(product), date(2026, 3, 15))

    def test_falls_back_to_created_at(self):
        product = MagicMock()
        product.updated_at = None
        product.created_at = datetime(2026, 2, 10, 12, 0)
        self.assertEqual(_product_lastmod_date(product), date(2026, 2, 10))

    def test_returns_none_without_dates(self):
        product = MagicMock()
        product.updated_at = None
        product.created_at = None
        self.assertIsNone(_product_lastmod_date(product))


class BuildProductsSitemapXmlTests(unittest.TestCase):
    @patch("app.services.sitemap_service._iter_catalog_products")
    @patch("app.services.sitemap_service._resolve_origin")
    @patch("app.services.sitemap_service.is_working_catalog_product", return_value=True)
    @patch("app.services.sitemap_service.build_product_page_url", return_value="https://svoygarage.ru/part/1-a-b")
    def test_lastmod_differs_by_product_dates(
        self,
        _build_url,
        _is_working,
        mock_origin,
        mock_iter,
    ):
        mock_origin.return_value = "https://svoygarage.ru"
        older = MagicMock()
        older.id = 1
        older.is_new = True
        older.updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
        older.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
        newer = MagicMock()
        newer.id = 2
        newer.is_new = False
        newer.updated_at = datetime(2026, 5, 20, tzinfo=timezone.utc)
        newer.created_at = datetime(2026, 5, 1, tzinfo=timezone.utc)
        mock_iter.return_value = [older, newer]

        xml, url_count = build_products_sitemap_xml(MagicMock())

        self.assertEqual(url_count, 2)
        self.assertIn("<lastmod>2026-01-01</lastmod>", xml)
        self.assertIn("<lastmod>2026-05-20</lastmod>", xml)
        self.assertNotIn("<lastmod>2026-05-29</lastmod>", xml)


class SitemapIndexXmlTests(unittest.TestCase):
    def test_fallback_index_contains_pages_only(self):
        xml = build_fallback_sitemap_index_xml("https://svoygarage.ru")
        self.assertIn("<loc>https://svoygarage.ru/sitemap-pages.xml</loc>", xml)
        self.assertNotIn("sitemap-products", xml)

    def test_index_uses_products_generated_at_and_pages_config(self):
        products_at = datetime(2026, 5, 28, 3, 0, tzinfo=timezone.utc)
        new_parts_at = datetime(2026, 5, 27, 12, 0, tzinfo=timezone.utc)
        with patch("app.services.sitemap_service.settings") as mock_settings:
            mock_settings.SITEMAP_PAGES_LASTMOD = "2026-05-23"
            xml = build_sitemap_index_xml(
                "https://svoygarage.ru",
                products_generated_at=products_at,
                new_parts_generated_at=new_parts_at,
            )

        self.assertIn("<loc>https://svoygarage.ru/sitemap-pages.xml</loc>", xml)
        self.assertIn("<lastmod>2026-05-23</lastmod>", xml)
        self.assertIn("<loc>https://svoygarage.ru/api/feeds/sitemap-products.xml</loc>", xml)
        self.assertIn("<lastmod>2026-05-28</lastmod>", xml)
        self.assertIn("<loc>https://svoygarage.ru/api/feeds/sitemap-new-parts.xml</loc>", xml)
        self.assertIn("<lastmod>2026-05-27</lastmod>", xml)


class BuildNewPartsSitemapXmlTests(unittest.TestCase):
    @patch("app.services.sitemap_service._resolve_origin", return_value="https://svoygarage.ru")
    @patch("app.services.sitemap_service.build_new_part_card_path", return_value="/autoparts/new/part/5-mann-w712")
    def test_includes_active_cards(self, _path, _origin):
        card = MagicMock()
        card.id = 5
        card.brand = "MANN"
        card.article = "W712"
        card.updated_at = datetime(2026, 5, 20, tzinfo=timezone.utc)
        card.is_active = True

        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [card]

        xml, url_count = build_new_parts_sitemap_xml(db)

        self.assertEqual(url_count, 1)
        self.assertIn("https://svoygarage.ru/autoparts/new/part/5-mann-w712", xml)
        self.assertIn("<lastmod>2026-05-20</lastmod>", xml)


class SitemapCacheTests(unittest.TestCase):
    def test_is_stale_when_missing_or_old(self):
        self.assertTrue(is_sitemap_cache_stale(None))
        old = datetime.now(timezone.utc).replace(year=2020)
        self.assertTrue(is_sitemap_cache_stale(old))
        fresh = datetime.now(timezone.utc)
        self.assertFalse(is_sitemap_cache_stale(fresh))

    @patch("app.services.sitemap_service.SeoSitemapCache")
    @patch("app.services.sitemap_service.build_products_sitemap_xml")
    def test_rebuild_products_sitemap_cache_persists_row(self, mock_build, mock_cache_cls):
        mock_build.return_value = ("<urlset></urlset>", 3)
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        row = MagicMock(cache_key=PRODUCTS_SITEMAP_CACHE_KEY, xml_content="<urlset></urlset>", url_count=3)
        row.generated_at = datetime.now(timezone.utc)
        mock_cache_cls.return_value = row

        snapshot = rebuild_products_sitemap_cache(db)

        self.assertEqual(snapshot.url_count, 3)
        mock_cache_cls.assert_called_once()
        self.assertEqual(mock_cache_cls.call_args.kwargs["cache_key"], PRODUCTS_SITEMAP_CACHE_KEY)
        self.assertEqual(mock_cache_cls.call_args.kwargs["url_count"], 3)
        db.add.assert_called_once_with(row)
        db.commit.assert_called_once()

    @patch("app.services.sitemap_service.rebuild_products_sitemap_cache")
    def test_get_products_sitemap_snapshot_rebuilds_when_cache_empty(self, mock_rebuild):
        mock_rebuild.return_value = MagicMock(
            xml_content="<urlset></urlset>",
            url_count=1,
            generated_at=datetime.now(timezone.utc),
        )
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        snapshot = get_products_sitemap_snapshot(db)

        mock_rebuild.assert_called_once_with(db, preferred_host_url=None)
        self.assertEqual(snapshot.url_count, 1)

    @patch("app.services.sitemap_service.SeoSitemapCache")
    @patch("app.services.sitemap_service.build_new_parts_sitemap_xml")
    def test_rebuild_new_parts_sitemap_cache_persists_row(self, mock_build, mock_cache_cls):
        mock_build.return_value = ("<urlset></urlset>", 2)
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        row = MagicMock(cache_key=NEW_PARTS_SITEMAP_CACHE_KEY, xml_content="<urlset></urlset>", url_count=2)
        row.generated_at = datetime.now(timezone.utc)
        mock_cache_cls.return_value = row

        snapshot = rebuild_new_parts_sitemap_cache(db)

        self.assertEqual(snapshot.url_count, 2)
        self.assertEqual(mock_cache_cls.call_args.kwargs["cache_key"], NEW_PARTS_SITEMAP_CACHE_KEY)


if __name__ == "__main__":
    unittest.main()
