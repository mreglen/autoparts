import unittest
from datetime import datetime
from unittest.mock import MagicMock, patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base
from app.models.laximo_snapshot import LaximoSnapshot, LaximoSnapshotAsset
from app.models.site_laximo_cat_integration import SiteLaximoCatIntegration
from app.services.laximo.gate import PUBLIC_OK, PUBLIC_TEMPORARILY_UNAVAILABLE
from app.services.laximo.snapshots import (
    KIND_UNIT_DETAILS,
    KIND_VIN_LOOKUP,
    get_snapshot_payload,
    make_categories_key,
    make_unit_details_key,
    make_vin_key,
    materialize_image_urls_in_payload,
    upsert_snapshot,
)
from app.services.laximo.unit_tree import clear_unit_tree_cache, get_categories, get_unit_with_details
from app.services.laximo.vehicle_lookup import clear_find_vehicle_cache, lookup_by_vin


class LaximoSnapshotKeyTests(unittest.TestCase):
    def test_keys_ignore_ssd(self):
        a = make_categories_key("AUDI", "123", "-1")
        b = make_categories_key("AUDI", "123", "-1")
        self.assertEqual(a, b)
        self.assertNotIn("ssd", a)
        self.assertEqual(make_vin_key("wba123"), "vin:WBA123")
        self.assertEqual(
            make_unit_details_key("AUDI", "1", "u9"),
            "unit:AUDI:1:u9",
        )


class LaximoSnapshotStoreTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            bind=self.engine,
            tables=[
                SiteLaximoCatIntegration.__table__,
                LaximoSnapshot.__table__,
                LaximoSnapshotAsset.__table__,
            ],
        )
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()
        self.db.add(
            SiteLaximoCatIntegration(
                id=1,
                is_enabled=False,
                last_test_ok=False,
                snapshots_fallback_enabled=True,
            )
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_upsert_and_get_vin(self):
        key = make_vin_key("WVWZZZ1JZ3W386752")
        upsert_snapshot(
            self.db,
            kind=KIND_VIN_LOOKUP,
            resource_key=key,
            payload={"candidates": [{"make": "VW", "catalog": "VW", "vehicle_id": "1"}]},
            vin="WVWZZZ1JZ3W386752",
        )
        loaded = get_snapshot_payload(self.db, KIND_VIN_LOOKUP, key)
        self.assertIsNotNone(loaded)
        payload, fetched_at = loaded
        self.assertEqual(payload["candidates"][0]["make"], "VW")
        self.assertIsInstance(fetched_at, datetime)

        upsert_snapshot(
            self.db,
            kind=KIND_VIN_LOOKUP,
            resource_key=key,
            payload={"candidates": [{"make": "Audi", "catalog": "AUDI", "vehicle_id": "2"}]},
            vin="WVWZZZ1JZ3W386752",
        )
        loaded2 = get_snapshot_payload(self.db, KIND_VIN_LOOKUP, key)
        self.assertEqual(loaded2[0]["candidates"][0]["make"], "Audi")
        self.assertGreaterEqual(loaded2[1], fetched_at)

    def test_materialize_image_rewrites_url(self):
        with patch(
            "app.services.laximo.snapshots.get_or_download_asset",
            return_value="/uploads/laximo/abc.jpg",
        ):
            out = materialize_image_urls_in_payload(
                self.db,
                {"unit": {"image_url": "https://cdn.example/img/%size%.png"}},
                commit=False,
            )
        self.assertEqual(out["unit"]["image_url"], "/uploads/laximo/abc.jpg")
        self.assertEqual(out["unit"]["image_local_url"], "/uploads/laximo/abc.jpg")


class LaximoSnapshotFallbackTests(unittest.TestCase):
    def setUp(self):
        clear_find_vehicle_cache()
        clear_unit_tree_cache()
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            bind=self.engine,
            tables=[
                SiteLaximoCatIntegration.__table__,
                LaximoSnapshot.__table__,
                LaximoSnapshotAsset.__table__,
            ],
        )
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()
        self.db.add(
            SiteLaximoCatIntegration(
                id=1,
                is_enabled=False,
                last_test_ok=False,
                snapshots_fallback_enabled=True,
            )
        )
        self.db.commit()

    def tearDown(self):
        clear_find_vehicle_cache()
        clear_unit_tree_cache()
        self.db.close()
        self.engine.dispose()

    def test_vin_offline_returns_snapshot(self):
        vin = "WVWZZZ1JZ3W386752"
        upsert_snapshot(
            self.db,
            kind=KIND_VIN_LOOKUP,
            resource_key=make_vin_key(vin),
            payload={
                "candidates": [
                    {
                        "make": "VW",
                        "model": "Golf",
                        "catalog": "VW2020",
                        "vehicle_id": "42",
                        "ssd": "stale",
                        "attributes_raw": [],
                    }
                ]
            },
            vin=vin,
        )
        with patch("app.services.laximo.vehicle_lookup.laximo_cat_ready", return_value=False):
            with patch("app.services.laximo.vehicle_lookup.find_vehicle") as find_mock:
                result = lookup_by_vin(self.db, vin)
                find_mock.assert_not_called()
        self.assertTrue(result.ok)
        self.assertEqual(result.reason, PUBLIC_OK)
        self.assertTrue(result.from_snapshot)
        self.assertEqual(result.candidates[0].make, "VW")
        self.assertEqual(result.candidates[0].vehicle_id, "42")

    def test_unit_offline_returns_snapshot_without_ssd(self):
        catalog = "AUDI2016"
        vehicle_id = "99"
        unit_id = "U1"
        upsert_snapshot(
            self.db,
            kind=KIND_UNIT_DETAILS,
            resource_key=make_unit_details_key(catalog, vehicle_id, unit_id),
            payload={
                "unit": {"unit_id": unit_id, "name": "Filter", "image_url": "/uploads/laximo/x.jpg"},
                "details": [{"oem": "8K0", "name": "Air filter"}],
            },
            catalog=catalog,
            vehicle_id=vehicle_id,
        )
        with patch("app.services.laximo.unit_tree.laximo_cat_ready", return_value=False):
            with patch("app.services.laximo.unit_tree.cat_client") as client:
                result = get_unit_with_details(
                    self.db,
                    catalog=catalog,
                    vehicle_id=vehicle_id,
                    ssd="",
                    unit_id=unit_id,
                )
                client.get_unit_info.assert_not_called()
        self.assertTrue(result.ok)
        self.assertTrue(result.from_snapshot)
        self.assertEqual(result.payload["details"][0]["oem"], "8K0")

    def test_categories_offline_without_live(self):
        catalog = "AUDI2016"
        vehicle_id = "99"
        upsert_snapshot(
            self.db,
            kind="categories",
            resource_key=make_categories_key(catalog, vehicle_id, "-1"),
            payload={"category_id": "-1", "categories": [{"category_id": "1", "name": "Engine"}]},
            catalog=catalog,
            vehicle_id=vehicle_id,
        )
        with patch("app.services.laximo.unit_tree.laximo_cat_ready", return_value=False):
            result = get_categories(
                self.db,
                catalog=catalog,
                vehicle_id=vehicle_id,
                ssd="ignored",
                category_id="-1",
            )
        self.assertTrue(result.ok)
        self.assertTrue(result.from_snapshot)
        self.assertEqual(result.payload["categories"][0]["name"], "Engine")

    def test_unavailable_when_no_snapshot(self):
        with patch("app.services.laximo.vehicle_lookup.laximo_cat_ready", return_value=False):
            result = lookup_by_vin(self.db, "WVWZZZ1JZ3W386752")
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, PUBLIC_TEMPORARILY_UNAVAILABLE)


if __name__ == "__main__":
    unittest.main()
