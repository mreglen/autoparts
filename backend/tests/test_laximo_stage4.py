import sys
import types
import unittest
from unittest.mock import MagicMock, patch

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

from app.services.laximo.vin import looks_like_vin, normalize_vin_or_none
from app.services.search_resolve_service import resolve_search_query


class LooksLikeVinTests(unittest.TestCase):
    def test_valid(self):
        self.assertTrue(looks_like_vin("WBA3A5C58CF123456"))
        self.assertEqual(normalize_vin_or_none("wba3a5c58cf123456"), "WBA3A5C58CF123456")

    def test_invalid_length(self):
        self.assertFalse(looks_like_vin("SHORT"))
        self.assertFalse(looks_like_vin("XW8ZZZ7PZD"))  # 10 chars
        self.assertTrue(looks_like_vin("XW8ZZZ7PZDG00269"))  # 16 — VAG/Rossko-style
        self.assertEqual(normalize_vin_or_none("xw8zzz7pzdg00269"), "XW8ZZZ7PZDG00269")

    def test_forbidden_letter(self):
        self.assertFalse(looks_like_vin("WBA3A5C58CF12345I"))

    def test_pure_numeric_rejected(self):
        self.assertFalse(looks_like_vin("12345678901234567"))

    def test_spaces_and_dashes(self):
        self.assertEqual(
            normalize_vin_or_none("WBA 3A5C58-CF123456"),
            "WBA3A5C58CF123456",
        )
        self.assertEqual(
            normalize_vin_or_none("xw8zzz7pzdg–00269"),
            "XW8ZZZ7PZDG00269",
        )
        self.assertTrue(looks_like_vin("WBA3A5C58 CF123456"))

    def test_cyrillic_lookalikes(self):
        # Н→H, С→C (Cyrillic letters that look like Latin)
        self.assertEqual(
            normalize_vin_or_none("WBA3A5С58СF123456"),
            "WBA3A5C58CF123456",
        )
        self.assertTrue(looks_like_vin("ХW8ZZZ7PZDG00269"))  # Х→X


class ResolveVinTests(unittest.TestCase):
    def test_vin_ready_redirects_to_catalog(self):
        db = MagicMock()
        with patch(
            "app.services.search_resolve_service.laximo_cat_ready",
            return_value=True,
        ):
            result = resolve_search_query(db, "WBA3A5C58CF123456", site_origin="https://ex.ru")
        self.assertEqual(result.match_type, "vin_catalog")
        self.assertTrue(result.redirect_path.startswith("/autoparts/vin?vin="))

    def test_spaced_vin_ready_redirects(self):
        db = MagicMock()
        with patch(
            "app.services.search_resolve_service.laximo_cat_ready",
            return_value=True,
        ):
            result = resolve_search_query(db, "WBA 3A5C58-CF123456", site_origin="https://ex.ru")
        self.assertEqual(result.match_type, "vin_catalog")
        self.assertIn("WBA3A5C58CF123456", result.redirect_path)
    def test_vin_not_ready_fallback_not_vin_route(self):
        db = MagicMock()
        with patch(
            "app.services.search_resolve_service.laximo_cat_ready",
            return_value=False,
        ):
            result = resolve_search_query(db, "WBA3A5C58CF123456", site_origin="https://ex.ru")
        self.assertEqual(result.match_type, "vin_unavailable")
        self.assertIn("/autoparts/used", result.redirect_path)
        self.assertNotIn("/autoparts/vin", result.redirect_path)
        self.assertIn("vin_unavailable=1", result.redirect_path)


class OemAvailabilityTests(unittest.TestCase):
    def test_empty_list(self):
        from app.services.laximo.oem_availability import lookup_oem_availability

        out = lookup_oem_availability(MagicMock(), [])
        self.assertTrue(out["ok"])
        self.assertEqual(out["items"], [])

    def test_batch_with_mocks(self):
        from app.services.laximo.oem_availability import lookup_oem_availability

        db = MagicMock()
        product = MagicMock()
        product.id = 77
        with patch(
            "app.services.laximo.oem_availability.laximo_doc_ready",
            return_value=False,
        ), patch(
            "app.services.laximo.oem_availability._lookup_rossko",
            return_value={
                "available": True,
                "count": 2,
                "min_price": 1200.0,
                "sample": {"brand": "AUDI", "article": "8K0121451D"},
            },
        ), patch(
            "app.services.laximo.oem_availability._lookup_used",
            return_value={"available": True, "count": 1, "sample_product_id": 77},
        ):
            out = lookup_oem_availability(db, ["8K0121451D", "8K0121451D"])
        self.assertEqual(len(out["items"]), 1)
        item = out["items"][0]
        self.assertTrue(item["rossko"]["available"])
        self.assertEqual(item["rossko"]["min_price"], 1200.0)
        self.assertTrue(item["used"]["available"])
        self.assertFalse(item["analogs"]["available"])

    def test_partial_rossko_fail(self):
        from app.services.laximo.oem_availability import lookup_oem_availability

        with patch(
            "app.services.laximo.oem_availability.laximo_doc_ready",
            return_value=False,
        ), patch(
            "app.services.laximo.oem_availability._lookup_rossko",
            return_value={"available": False, "count": 0, "min_price": None, "sample": None},
        ), patch(
            "app.services.laximo.oem_availability._lookup_used",
            return_value={"available": False, "count": 0, "sample_product_id": None},
        ):
            out = lookup_oem_availability(MagicMock(), ["OEM1"])
        self.assertTrue(out["ok"])
        self.assertFalse(out["items"][0]["rossko"]["available"])


class PublicByVinSoftFailTests(unittest.TestCase):
    def test_gate_not_ready(self):
        from app.services.laximo.vehicle_lookup import clear_find_vehicle_cache, lookup_by_vin

        clear_find_vehicle_cache()
        db = MagicMock()
        with patch(
            "app.services.laximo.vehicle_lookup.laximo_cat_ready",
            return_value=False,
        ), patch(
            "app.services.laximo.vehicle_lookup.find_vehicle"
        ) as mock_find:
            result = lookup_by_vin(db, "WBA3A5C58CF123456")
            mock_find.assert_not_called()
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "temporarily_unavailable")
        lowered = (result.message or "").lower()
        for word in ("laximo", "квота", "лимит", "api"):
            self.assertNotIn(word, lowered)
        clear_find_vehicle_cache()


class PublicSiteConfigFlagTests(unittest.TestCase):
    def test_flag_true_false(self):
        from app.routers.auth import get_public_site_config

        db = MagicMock()
        settings_row = MagicMock()
        settings_row.show_new_autoparts = True
        settings_row.show_site_reviews = True
        settings_row.show_yandex_badge = True
        settings_row.show_warehouse_inventory = False
        settings_row.show_autoservice = False
        settings_row.used_parts_purchase_mode = "both"
        settings_row.round_product_prices = False

        with patch(
            "app.routers.auth.get_or_create_site_settings",
            return_value=settings_row,
        ), patch(
            "app.routers.auth.global_markup_percent",
            return_value=15,
        ), patch(
            "app.routers.auth.resolve_autoservice_organization_id",
            return_value=None,
        ), patch(
            "app.routers.auth.laximo_cat_ready",
            return_value=True,
        ):
            db.query.return_value.filter.return_value.first.return_value = None
            cfg = get_public_site_config(organization_id=None, db=db)
        self.assertTrue(cfg["laximo_vin_catalog_available"])

        with patch(
            "app.routers.auth.get_or_create_site_settings",
            return_value=settings_row,
        ), patch(
            "app.routers.auth.global_markup_percent",
            return_value=15,
        ), patch(
            "app.routers.auth.resolve_autoservice_organization_id",
            return_value=None,
        ), patch(
            "app.routers.auth.laximo_cat_ready",
            return_value=False,
        ):
            db.query.return_value.filter.return_value.first.return_value = None
            cfg2 = get_public_site_config(organization_id=None, db=db)
        self.assertFalse(cfg2["laximo_vin_catalog_available"])


if __name__ == "__main__":
    unittest.main()
