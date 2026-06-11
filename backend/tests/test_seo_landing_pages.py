import unittest

import app.models  # noqa: F401
import app.models.organization_avito_integration  # noqa: F401
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.models.seo_landing_page import SeoLandingPage
from app.schemas.seo_landing_page import SeoLandingPageCreate, SeoLandingPageUpdate
from app.services.seo_landing_page_service import (
    SeoLandingPageValidationError,
    build_meta_description,
    build_meta_title,
    create_landing_page,
    resolve_brand_used_landing,
    resolve_category_new_landing,
    resolve_category_used_landing,
    resolve_geo_landing,
    resolve_landing_page,
    seed_landing_pages_from_catalog,
    update_landing_page,
)


class SeoLandingPageServiceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        self._create_tables()
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _create_tables(self):
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    CREATE TABLE part_types (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name VARCHAR(100) NOT NULL UNIQUE
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE organizations (
                        id VARCHAR(10) PRIMARY KEY,
                        name VARCHAR(255),
                        address TEXT
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE products (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        part_type_id INTEGER NOT NULL,
                        quantity INTEGER DEFAULT 0,
                        brand VARCHAR(120),
                        is_new INTEGER NOT NULL DEFAULT 0,
                        organization_id VARCHAR(10)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE new_parts_seo_cards (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        source VARCHAR(32) NOT NULL DEFAULT 'rossko',
                        stable_key VARCHAR(255) NOT NULL UNIQUE,
                        brand VARCHAR(120) NOT NULL,
                        article VARCHAR(120) NOT NULL,
                        name VARCHAR(512),
                        is_active INTEGER NOT NULL DEFAULT 1
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE seo_landing_pages (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        kind VARCHAR(32) NOT NULL,
                        slug VARCHAR(120) NOT NULL,
                        title_ru VARCHAR(255) NOT NULL,
                        search_query VARCHAR(255),
                        brand_name VARCHAR(120),
                        part_type_id INTEGER,
                        city VARCHAR(120),
                        meta_title VARCHAR(255),
                        meta_description VARCHAR(512),
                        intro_html TEXT,
                        is_active INTEGER NOT NULL DEFAULT 1,
                        priority INTEGER NOT NULL DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE (kind, slug)
                    )
                    """
                )
            )

    def _seed_catalog_data(self):
        with self.engine.begin() as conn:
            for brand, count in [("BOSCH", 5), ("MANN-FILTER", 3), ("NGK", 1)]:
                for i in range(count):
                    conn.execute(
                        text(
                            """
                            INSERT INTO new_parts_seo_cards
                            (source, stable_key, brand, article, is_active)
                            VALUES ('rossko', :key, :brand, :article, 1)
                            """
                        ),
                        {"key": f"rossko|{brand.lower()}|{i}", "brand": brand, "article": f"A{i}"},
                    )
            conn.execute(text("INSERT INTO part_types (name) VALUES ('Тормозные колодки')"))
            conn.execute(text("INSERT INTO part_types (name) VALUES ('Масляный фильтр')"))
            conn.execute(
                text(
                    "INSERT INTO products (part_type_id, quantity, brand, is_new, organization_id) "
                    "VALUES (1, 10, 'BOSCH', 0, 'org1'), (1, 5, 'BOSCH', 0, 'org1'), (2, 2, 'NGK', 0, 'org2')"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO organizations (id, name, address) "
                    "VALUES ('org1', 'Org 1', 'г. Екатеринбург, ул. Test'), "
                    "('org2', 'Org 2', 'г. Москва, ул. Other')"
                )
            )

    def test_create_brand_new_auto_slug(self):
        row = create_landing_page(
            self.db,
            SeoLandingPageCreate(kind="brand_new", title_ru="BOSCH", brand_name="BOSCH"),
        )
        self.assertEqual(row.slug, "bosch")
        self.assertEqual(row.brand_name, "BOSCH")

    def test_create_category_new_auto_slug(self):
        row = create_landing_page(
            self.db,
            SeoLandingPageCreate(
                kind="category_new",
                title_ru="Тормозные колодки",
                search_query="тормозные колодки",
            ),
        )
        self.assertEqual(row.slug, "tormoznye-kolodki")
        self.assertEqual(row.search_query, "тормозные колодки")

    def test_unique_kind_slug_constraint(self):
        create_landing_page(
            self.db,
            SeoLandingPageCreate(kind="brand_new", title_ru="BOSCH", brand_name="BOSCH"),
        )
        with self.assertRaises(SeoLandingPageValidationError):
            create_landing_page(
                self.db,
                SeoLandingPageCreate(kind="brand_new", title_ru="Bosch dup", brand_name="BOSCH"),
            )

    def test_resolve_brand_new_filters(self):
        create_landing_page(
            self.db,
            SeoLandingPageCreate(kind="brand_new", title_ru="BOSCH", brand_name="BOSCH"),
        )
        resolved = resolve_landing_page(self.db, "brand_new", "bosch")
        self.assertIsNotNone(resolved)
        self.assertEqual(resolved.filters["brand"], "BOSCH")
        self.assertEqual(resolved.canonical_path, "/autoparts/new/brand/bosch")
        self.assertIn("BOSCH", resolved.meta_title)

    def test_resolve_category_new_filters(self):
        create_landing_page(
            self.db,
            SeoLandingPageCreate(
                kind="category_new",
                title_ru="Тормозные колодки",
                search_query="тормозные колодки",
            ),
        )
        resolved = resolve_landing_page(self.db, "category_new", "tormoznye-kolodki")
        self.assertIsNotNone(resolved)
        self.assertEqual(resolved.filters["search_query"], "тормозные колодки")
        self.assertEqual(resolved.filters["category_slug"], "tormoznye-kolodki")

    def test_resolve_category_new_landing_with_count(self):
        create_landing_page(
            self.db,
            SeoLandingPageCreate(
                kind="category_new",
                title_ru="Тормозные колодки",
                search_query="тормозные колодки",
            ),
        )
        resolved = resolve_category_new_landing(self.db, "tormoznye-kolodki", card_count=12)
        self.assertIsNotNone(resolved)
        self.assertIn("12 позиций", resolved.meta_description)
        self.assertEqual(
            resolved.canonical_path,
            "/autoparts/new/category/tormoznye-kolodki",
        )

    def test_resolve_category_new_landing_missing_returns_none(self):
        self.assertIsNone(resolve_category_new_landing(self.db, "missing"))

    def test_resolve_inactive_returns_none(self):
        create_landing_page(
            self.db,
            SeoLandingPageCreate(
                kind="brand_new",
                title_ru="BOSCH",
                brand_name="BOSCH",
                is_active=False,
            ),
        )
        self.assertIsNone(resolve_landing_page(self.db, "brand_new", "bosch"))

    def test_meta_templates(self):
        row = SeoLandingPage(
            kind="brand_new",
            slug="bosch",
            title_ru="BOSCH",
            brand_name="BOSCH",
            is_active=True,
            priority=0,
        )
        self.assertIn("BOSCH", build_meta_title(row))
        self.assertIn("BOSCH", build_meta_description(row))

    def test_validation_missing_brand_name(self):
        with self.assertRaises(SeoLandingPageValidationError):
            create_landing_page(
                self.db,
                SeoLandingPageCreate(kind="brand_new", title_ru="Без бренда"),
            )

    def test_update_slug(self):
        row = create_landing_page(
            self.db,
            SeoLandingPageCreate(kind="brand_new", title_ru="BOSCH", brand_name="BOSCH"),
        )
        updated = update_landing_page(
            self.db,
            row,
            SeoLandingPageUpdate(title_ru="MANN-FILTER", brand_name="MANN-FILTER", slug="mann-filter"),
        )
        self.assertEqual(updated.slug, "mann-filter")
        self.assertEqual(updated.brand_name, "MANN-FILTER")

    def test_seed_from_catalog(self):
        self._seed_catalog_data()
        result = seed_landing_pages_from_catalog(self.db, force=False)
        self.assertGreaterEqual(result.created_brand_new, 1)
        self.assertGreaterEqual(result.created_category_new, 1)
        self.assertGreaterEqual(result.total_rows, 2)

        second = seed_landing_pages_from_catalog(self.db, force=False)
        self.assertEqual(second.created_brand_new, 0)
        self.assertEqual(second.created_category_new, 0)

    def test_seed_force_adds_missing_only(self):
        self._seed_catalog_data()
        seed_landing_pages_from_catalog(self.db, force=False)
        self.db.query(SeoLandingPage).filter(SeoLandingPage.kind == "brand_new").delete()
        self.db.commit()
        result = seed_landing_pages_from_catalog(self.db, force=True)
        self.assertGreaterEqual(result.created_brand_new, 1)


    def test_resolve_brand_used_registry(self):
        create_landing_page(
            self.db,
            SeoLandingPageCreate(kind="brand_used", title_ru="BOSCH", brand_name="BOSCH"),
        )
        resolved = resolve_brand_used_landing(self.db, "bosch", product_count=3)
        self.assertIsNotNone(resolved)
        self.assertEqual(resolved.canonical_path, "/autoparts/used/brand/bosch")
        self.assertIn("3 б/у", resolved.meta_description)

    def test_resolve_brand_used_fallback_from_catalog(self):
        self._seed_catalog_data()
        resolved = resolve_brand_used_landing(self.db, "bosch", product_count=2)
        self.assertIsNotNone(resolved)
        self.assertEqual(resolved.brand_name, "BOSCH")

    def test_resolve_category_used_registry_only(self):
        create_landing_page(
            self.db,
            SeoLandingPageCreate(
                kind="category_used",
                title_ru="Тормозные колодки",
                search_query="тормозные колодки",
            ),
        )
        resolved = resolve_category_used_landing(self.db, "tormoznye-kolodki", product_count=5)
        self.assertIsNotNone(resolved)
        self.assertIn("5 объявлений", resolved.meta_description)

    def test_resolve_category_used_missing_returns_none(self):
        self.assertIsNone(resolve_category_used_landing(self.db, "missing"))

    def test_resolve_geo_landing(self):
        create_landing_page(
            self.db,
            SeoLandingPageCreate(kind="geo", title_ru="Екатеринбург", city="Екатеринбург"),
        )
        resolved = resolve_geo_landing(self.db, "ekaterinburg", product_count=7)
        self.assertIsNotNone(resolved)
        self.assertEqual(resolved.canonical_path, "/autoparts/used/geo/ekaterinburg")
        self.assertIn("Екатеринбурге", resolved.meta_title)

    def test_seed_creates_used_landings(self):
        self._seed_catalog_data()
        result = seed_landing_pages_from_catalog(self.db, force=True)
        self.assertGreaterEqual(result.created_brand_used, 1)
        self.assertGreaterEqual(result.created_category_used, 1)
        self.assertGreaterEqual(result.created_geo, 1)


if __name__ == "__main__":
    unittest.main()
