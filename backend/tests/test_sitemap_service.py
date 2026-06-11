import json
import unittest
from datetime import date, datetime, timezone
from unittest.mock import MagicMock, patch

from app.services.sitemap_service import (
    NEW_PARTS_SITEMAP_CACHE_KEY,
    PRODUCTS_SITEMAP_CACHE_KEY,
    _product_lastmod_date,
    _split_seo_url_limit,
    append_new_part_card_to_sitemap_cache,
    build_fallback_sitemap_index_xml,
    build_new_parts_sitemap_xml,
    build_products_sitemap_xml,
    build_sitemap_index_xml,
    generate_product_urls_text_file,
    get_products_sitemap_snapshot,
    is_sitemap_cache_stale,
    rebuild_new_parts_sitemap_cache,
    rebuild_products_sitemap_cache,
)


class SplitSeoUrlLimitTests(unittest.TestCase):
    def test_even_limit(self):
        self.assertEqual(_split_seo_url_limit(150), (75, 75))

    def test_odd_limit(self):
        self.assertEqual(_split_seo_url_limit(151), (75, 76))


class GenerateProductUrlsTextFileTests(unittest.TestCase):
    def test_file_contains_only_urls_one_per_line(self):
        content = generate_product_urls_text_file(
            MagicMock(),
            limit=150,
            used_items=[{"url": "https://svoygarage.ru/part/1-a-b"}],
            rossko_items=[{"url": "https://svoygarage.ru/autoparts/new/part/2-a-b"}],
            export_date=date(2026, 6, 5),
            created_new_batch=True,
        )
        lines = content.strip().split("\n")
        self.assertEqual(lines, [
            "https://svoygarage.ru/part/1-a-b",
            "https://svoygarage.ru/autoparts/new/part/2-a-b",
        ])
        for line in lines:
            self.assertTrue(line.startswith("https://"))
            self.assertNotIn("#", line)


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
        self.assertIn("<loc>https://svoygarage.ru/api/feeds/sitemap-new-brands.xml</loc>", xml)


class NewCategoriesSitemapTests(unittest.TestCase):
    def test_build_new_categories_sitemap_xml(self):
        from app.models.seo_landing_page import SeoLandingPage
        from app.services.sitemap_service import build_new_categories_sitemap_xml

        db = MagicMock()
        row = SeoLandingPage(
            kind="category_new",
            slug="tormoznye-kolodki",
            title_ru="Тормозные колодки",
            search_query="тормозные колодки",
            is_active=True,
            priority=1,
        )
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [row]
        xml, count = build_new_categories_sitemap_xml(db, preferred_host_url="https://svoygarage.ru")
        self.assertEqual(count, 1)
        self.assertIn("/autoparts/new/category/tormoznye-kolodki", xml)

    def test_index_includes_categories_sitemap(self):
        products_at = datetime(2026, 5, 28, 3, 0, tzinfo=timezone.utc)
        new_parts_at = datetime(2026, 5, 27, 12, 0, tzinfo=timezone.utc)
        new_brands_at = datetime(2026, 5, 26, 12, 0, tzinfo=timezone.utc)
        new_categories_at = datetime(2026, 5, 25, 12, 0, tzinfo=timezone.utc)
        with patch("app.services.sitemap_service.settings") as mock_settings:
            mock_settings.SITEMAP_PAGES_LASTMOD = "2026-05-23"
            xml = build_sitemap_index_xml(
                "https://svoygarage.ru",
                products_generated_at=products_at,
                new_parts_generated_at=new_parts_at,
                new_brands_generated_at=new_brands_at,
                new_categories_generated_at=new_categories_at,
            )

        self.assertIn("<loc>https://svoygarage.ru/api/feeds/sitemap-new-categories.xml</loc>", xml)
        self.assertIn("<lastmod>2026-05-25</lastmod>", xml)


class UsedLandingsSitemapTests(unittest.TestCase):
    def test_build_used_brands_sitemap_xml(self):
        from app.models.seo_landing_page import SeoLandingPage
        from app.services.sitemap_service import build_used_brands_sitemap_xml

        db = MagicMock()
        row = SeoLandingPage(
            kind="brand_used",
            slug="bosch",
            title_ru="BOSCH",
            brand_name="BOSCH",
            is_active=True,
            priority=1,
        )
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [row]
        xml, count = build_used_brands_sitemap_xml(db, preferred_host_url="https://svoygarage.ru")
        self.assertEqual(count, 1)
        self.assertIn("/autoparts/used/brand/bosch", xml)

    def test_index_includes_used_sitemaps(self):
        products_at = datetime(2026, 5, 28, 3, 0, tzinfo=timezone.utc)
        used_at = datetime(2026, 5, 24, 12, 0, tzinfo=timezone.utc)
        with patch("app.services.sitemap_service.settings") as mock_settings:
            mock_settings.SITEMAP_PAGES_LASTMOD = "2026-05-23"
            xml = build_sitemap_index_xml(
                "https://svoygarage.ru",
                products_generated_at=products_at,
                used_brands_generated_at=used_at,
                used_categories_generated_at=used_at,
                used_geo_generated_at=used_at,
            )

        self.assertIn("<loc>https://svoygarage.ru/api/feeds/sitemap-used-brands.xml</loc>", xml)
        self.assertIn("<loc>https://svoygarage.ru/api/feeds/sitemap-used-categories.xml</loc>", xml)
        self.assertIn("<loc>https://svoygarage.ru/api/feeds/sitemap-used-geo.xml</loc>", xml)


class NewBrandsSitemapTests(unittest.TestCase):
    def test_build_new_brands_sitemap_xml(self):
        from app.models.seo_landing_page import SeoLandingPage
        from app.services.sitemap_service import build_new_brands_sitemap_xml

        db = MagicMock()
        row = SeoLandingPage(
            kind="brand_new",
            slug="bosch",
            title_ru="BOSCH",
            brand_name="BOSCH",
            is_active=True,
            priority=1,
        )
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [row]
        xml, count = build_new_brands_sitemap_xml(db, preferred_host_url="https://svoygarage.ru")
        self.assertEqual(count, 1)
        self.assertIn("/autoparts/new/brand/bosch", xml)


class RosskoNewPartSitemapEligibilityTests(unittest.TestCase):
    def test_requires_rossko_source_and_api_payload(self):
        from app.services.new_parts_seo_card_service import is_rossko_new_part_sitemap_eligible

        card = MagicMock()
        card.is_active = True
        card.source = "rossko"
        card.brand = "MANN"
        card.article = "W712"
        card.raw_payload = json.dumps({"guid": "abc-123", "stocks": []})

        with patch(
            "app.services.new_parts_seo_card_service._stocks_from_card",
            return_value=[],
        ):
            self.assertTrue(is_rossko_new_part_sitemap_eligible(card))

        card.source = "manual"
        self.assertFalse(is_rossko_new_part_sitemap_eligible(card))


class BuildNewPartsSitemapXmlTests(unittest.TestCase):
    @patch("app.services.sitemap_service._resolve_origin", return_value="https://svoygarage.ru")
    @patch("app.services.sitemap_service.build_new_part_card_path", return_value="/autoparts/new/part/5-mann-w712")
    @patch(
        "app.services.sitemap_service.iter_rossko_new_part_cards_for_sitemap",
    )
    def test_includes_rossko_cards(self, mock_iter, _path, _origin):
        card = MagicMock()
        card.id = 5
        card.brand = "MANN"
        card.article = "W712"
        card.updated_at = datetime(2026, 5, 20, tzinfo=timezone.utc)
        mock_iter.return_value = [card]

        xml, url_count = build_new_parts_sitemap_xml(MagicMock())

        self.assertEqual(url_count, 1)
        self.assertIn("https://svoygarage.ru/autoparts/new/part/5-mann-w712", xml)
        self.assertIn("<lastmod>2026-05-20</lastmod>", xml)


class AppendNewPartSitemapCacheTests(unittest.TestCase):
    @patch("app.services.sitemap_service.is_rossko_new_part_sitemap_eligible", return_value=True)
    @patch("app.services.sitemap_service._resolve_origin", return_value="https://svoygarage.ru")
    @patch("app.services.sitemap_service.build_new_part_card_path", return_value="/autoparts/new/part/9-mann-w712")
    @patch("app.services.sitemap_service.rebuild_new_parts_sitemap_cache")
    @patch("app.services.sitemap_service.get_new_parts_sitemap_cache_row")
    @patch("app.services.sitemap_service._persist_sitemap_cache")
    def test_appends_url_without_touching_products_cache(
        self,
        mock_persist,
        mock_get_row,
        mock_rebuild,
        _path,
        _origin,
        _eligible,
    ):
        card = MagicMock()
        card.id = 9
        card.brand = "MANN"
        card.article = "W712"
        card.updated_at = datetime(2026, 6, 2, tzinfo=timezone.utc)

        row = MagicMock()
        row.xml_content = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            "</urlset>\n"
        )
        row.url_count = 0
        mock_get_row.return_value = row

        db = MagicMock()
        added = append_new_part_card_to_sitemap_cache(db, card)

        self.assertTrue(added)
        mock_rebuild.assert_not_called()
        mock_persist.assert_called_once()
        persist_kwargs = mock_persist.call_args.kwargs
        self.assertEqual(persist_kwargs["cache_key"], NEW_PARTS_SITEMAP_CACHE_KEY)
        self.assertIn("https://svoygarage.ru/autoparts/new/part/9-mann-w712", persist_kwargs["xml_content"])
        self.assertNotIn("/part/211-", persist_kwargs["xml_content"])


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


class SummarizeSitePageCountsTests(unittest.TestCase):
    def test_excludes_index_and_admin_entries(self):
        items = [
            {"id": "index", "type": "index", "url_count": 8},
            {"id": "pages", "type": "static", "url_count": 10},
            {"id": "products", "type": "dynamic", "url_count": 100},
            {"id": "admin", "type": "admin", "url_count": 3},
        ]
        from app.services.sitemap_service import summarize_site_page_counts

        self.assertEqual(summarize_site_page_counts(items), 110)


if __name__ == "__main__":
    unittest.main()
