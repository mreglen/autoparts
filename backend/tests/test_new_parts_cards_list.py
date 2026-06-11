import unittest

import app.models  # noqa: F401
import app.models.organization_avito_integration  # noqa: F401
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.models.new_parts_seo_card import NewPartsSeoCard
from app.services.new_parts_seo_card_service import (
    aggregate_top_brands_in_category,
    count_new_part_cards_by_brand,
    count_new_part_cards_by_category_slug,
    list_new_part_cards_by_brand,
    list_new_part_cards_by_category_slug,
)
from app.services.seo_landing_page_service import find_brand_name_by_slug, resolve_brand_new_landing
from app.models.seo_landing_page import SeoLandingPage


class NewPartsCardsListTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        self._create_tables()
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.db = self.Session()
        self._seed_cards()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _create_tables(self):
        with self.engine.begin() as conn:
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
                        description TEXT,
                        price NUMERIC(12,2),
                        currency VARCHAR(8) DEFAULT 'RUB',
                        stock_count INTEGER,
                        delivery_start DATETIME,
                        delivery_end DATETIME,
                        image_url TEXT,
                        raw_payload TEXT,
                        is_active INTEGER NOT NULL DEFAULT 1,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

    def _seed_cards(self):
        for i, article in enumerate(["A1", "A2", "A3", "A4", "A5"]):
            self.db.add(
                NewPartsSeoCard(
                    source="rossko",
                    stable_key=f"rossko|bosch|{article}",
                    brand="BOSCH",
                    article=article,
                    name=f"Part {article}",
                    stock_count=10 - i,
                    raw_payload='{"guid":"x","stocks":[{"stock_id":"1","price":100,"available_count":1}]}',
                    is_active=True,
                )
            )
        self.db.add(
            NewPartsSeoCard(
                source="rossko",
                stable_key="rossko|mann|w712",
                brand="MANN-FILTER",
                article="W712",
                name="Filter",
                stock_count=3,
                raw_payload='{"guid":"y","stocks":[{"stock_id":"1","price":200,"available_count":1}]}',
                is_active=True,
            )
        )
        self.db.add(
            NewPartsSeoCard(
                source="rossko",
                stable_key="rossko|bosch|bp123",
                brand="BOSCH",
                article="BP123",
                name="тормозные колодки передние",
                stock_count=8,
                raw_payload='{"guid":"z","stocks":[{"stock_id":"1","price":300,"available_count":1}]}',
                is_active=True,
            )
        )
        self.db.add(
            NewPartsSeoCard(
                source="rossko",
                stable_key="rossko|ate|bp456",
                brand="ATE",
                article="BP456",
                name="тормозные колодки задние",
                stock_count=5,
                raw_payload='{"guid":"w","stocks":[{"stock_id":"1","price":250,"available_count":1}]}',
                is_active=True,
            )
        )
        self.db.add(
            SeoLandingPage(
                kind="category_new",
                slug="tormoznye-kolodki",
                title_ru="Тормозные колодки",
                search_query="тормозные колодки",
                is_active=True,
                priority=50,
            )
        )
        self.db.commit()

    def test_count_and_list_by_brand(self):
        self.assertEqual(count_new_part_cards_by_brand(self.db, "BOSCH"), 6)
        rows, total = list_new_part_cards_by_brand(self.db, "BOSCH", page=1, page_size=2)
        self.assertEqual(total, 6)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0].brand, "BOSCH")

    def test_list_pagination(self):
        _, total = list_new_part_cards_by_brand(self.db, "BOSCH", page=3, page_size=2)
        rows, _ = list_new_part_cards_by_brand(self.db, "BOSCH", page=3, page_size=2)
        self.assertEqual(total, 6)
        self.assertEqual(len(rows), 2)

    def test_find_brand_name_by_slug(self):
        self.assertEqual(find_brand_name_by_slug(self.db, "bosch"), "BOSCH")
        self.assertEqual(find_brand_name_by_slug(self.db, "mann-filter"), "MANN-FILTER")
        self.assertIsNone(find_brand_name_by_slug(self.db, "missing"))

    def test_resolve_brand_new_landing_fallback(self):
        resolved = resolve_brand_new_landing(self.db, "bosch", card_count=6)
        self.assertIsNotNone(resolved)
        self.assertEqual(resolved.brand_name, "BOSCH")
        self.assertEqual(resolved.filters["brand"], "BOSCH")
        self.assertEqual(resolved.canonical_path, "/autoparts/new/brand/bosch")
        self.assertIn("6 позиций", resolved.meta_description)

    def test_count_and_list_by_category_slug(self):
        self.assertEqual(count_new_part_cards_by_category_slug(self.db, "tormoznye-kolodki"), 2)
        rows, total = list_new_part_cards_by_category_slug(
            self.db,
            "tormoznye-kolodki",
            page=1,
            page_size=1,
        )
        self.assertEqual(total, 2)
        self.assertEqual(len(rows), 1)
        self.assertIn("тормозные колодки", rows[0].name.lower())

    def test_aggregate_top_brands_in_category(self):
        brands = aggregate_top_brands_in_category(self.db, "tormoznye-kolodki")
        self.assertEqual(len(brands), 2)
        self.assertEqual(brands[0]["brand"], "BOSCH")
        self.assertEqual(brands[0]["slug"], "bosch")
        self.assertEqual(brands[0]["count"], 1)

    def test_unknown_category_slug_returns_empty(self):
        self.assertEqual(count_new_part_cards_by_category_slug(self.db, "missing"), 0)
        rows, total = list_new_part_cards_by_category_slug(self.db, "missing")
        self.assertEqual(total, 0)
        self.assertEqual(rows, [])


if __name__ == "__main__":
    unittest.main()
