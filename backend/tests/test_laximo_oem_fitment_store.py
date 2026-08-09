import sys
import types
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base
from app.models.laximo_oem_fitment import (
    LaximoApplicableVehicle,
    LaximoOemArticle,
    LaximoOemCatalogScan,
    LaximoOemVehicleLink,
)
from app.models.site_laximo_cat_integration import SiteLaximoCatIntegration
from app.services.laximo.gate import (
    product_card_quota_exhausted,
    reset_daily_counter_if_needed,
    try_reserve_product_card_request,
)
from app.services.laximo.oem_applicability_store import (
    STATUS_NOT_FOUND,
    STATUS_READY,
    get_or_create_article,
    load_vehicles_for_article,
    mark_article_status,
    upsert_vehicle_and_link,
)


class OemFitmentStoreTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            bind=self.engine,
            tables=[
                LaximoOemArticle.__table__,
                LaximoApplicableVehicle.__table__,
                LaximoOemVehicleLink.__table__,
                LaximoOemCatalogScan.__table__,
            ],
        )
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()

    def test_shared_oem_norm_for_different_raw_forms(self):
        a1 = get_or_create_article(self.db, oem_raw="W712/75")
        a2 = get_or_create_article(self.db, oem_raw="W71275")
        self.assertEqual(a1.id, a2.id)

    def test_many_to_many_vehicle_links(self):
        article_a = get_or_create_article(self.db, oem_raw="OEM-A")
        article_b = get_or_create_article(self.db, oem_raw="OEM-B")
        vehicle_row = {
            "catalog": "HYUNDAI202404",
            "brand": "HYUNDAI",
            "name": "MATRIX",
            "vehicle_id": "100",
            "year_from": "2001",
            "year_to": "2007",
            "attributes": None,
        }
        upsert_vehicle_and_link(self.db, article=article_a, normalized=vehicle_row)
        upsert_vehicle_and_link(self.db, article=article_b, normalized=vehicle_row)

        vehicles_a = load_vehicles_for_article(self.db, article_a.id)
        vehicles_b = load_vehicles_for_article(self.db, article_b.id)
        self.assertEqual(len(vehicles_a), 1)
        self.assertEqual(len(vehicles_b), 1)
        self.assertEqual(
            self.db.query(LaximoApplicableVehicle).count(),
            1,
        )
        self.assertEqual(
            self.db.query(LaximoOemVehicleLink).count(),
            2,
        )

    def test_negative_cache_not_found(self):
        article = get_or_create_article(self.db, oem_raw="MISSING-OEM")
        mark_article_status(self.db, article, status=STATUS_NOT_FOUND)
        self.db.refresh(article)
        self.assertEqual(article.status, STATUS_NOT_FOUND)
        self.assertIsNotNone(article.next_retry_at)


class ProductCardQuotaTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            bind=self.engine,
            tables=[SiteLaximoCatIntegration.__table__],
        )
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()
        row = SiteLaximoCatIntegration(
            id=1,
            product_card_daily_request_limit=2,
            product_card_requests_today=0,
        )
        self.db.add(row)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_reserve_until_exhausted(self):
        row = self.db.get(SiteLaximoCatIntegration, 1)
        self.assertTrue(try_reserve_product_card_request(self.db, row))
        self.assertTrue(try_reserve_product_card_request(self.db, row))
        self.assertFalse(try_reserve_product_card_request(self.db, row))
        row = self.db.get(SiteLaximoCatIntegration, 1)
        self.assertTrue(product_card_quota_exhausted(row))

    def test_daily_reset(self):
        row = self.db.get(SiteLaximoCatIntegration, 1)
        row.product_card_requests_today = 2
        row.product_card_requests_day = datetime.now(timezone.utc).date() - timedelta(days=1)
        reset_daily_counter_if_needed(row)
        self.assertEqual(row.product_card_requests_today, 0)


class ApplicableVehiclesDbFirstTests(unittest.TestCase):
    def setUp(self):
        from app.services.laximo.oem_applicability import clear_oem_applicability_cache

        clear_oem_applicability_cache()
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            bind=self.engine,
            tables=[
                LaximoOemArticle.__table__,
                LaximoApplicableVehicle.__table__,
                LaximoOemVehicleLink.__table__,
                LaximoOemCatalogScan.__table__,
            ],
        )
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()

    def test_db_hit_skips_upstream(self):
        from app.services.laximo.oem_applicability import lookup_applicable_vehicles

        article = get_or_create_article(self.db, oem_raw="0913128000")
        upsert_vehicle_and_link(
            self.db,
            article=article,
            normalized={
                "catalog": "HYUNDAI202404",
                "brand": "HYUNDAI",
                "name": "EXCEL",
                "vehicle_id": "1",
                "year_from": "1994",
                "year_to": "1999",
                "attributes": None,
            },
        )
        mark_article_status(self.db, article, status=STATUS_READY)

        with patch(
            "app.services.laximo.oem_applicability.cat_client.find_part_references"
        ) as refs:
            result = lookup_applicable_vehicles(self.db, oem="0913128000")
        refs.assert_not_called()
        self.assertTrue(result.ok)
        self.assertEqual(len(result.payload["vehicles"]), 1)
        self.assertEqual(result.payload["data_source"], "db")


if __name__ == "__main__":
    unittest.main()
