import unittest
from unittest.mock import MagicMock, patch

from app.services.laximo.catalog_features import (
    clear_catalog_features_cache,
    get_catalog_features,
    has_quickgroups,
)
from app.services.laximo.gate import (
    PUBLIC_TEMPORARILY_UNAVAILABLE,
    assert_public_message_safe,
)
from app.services.laximo.unit_tree import (
    PUBLIC_SESSION_EXPIRED,
    PUBLIC_SESSION_MESSAGE,
    clear_unit_tree_cache,
    get_categories,
    get_features,
    get_unit_with_details,
    get_units,
    normalize_category,
    normalize_detail,
)


class CatalogFeaturesTests(unittest.TestCase):
    def setUp(self):
        clear_catalog_features_cache()

    def tearDown(self):
        clear_catalog_features_cache()

    def test_extract_quickgroups_from_list(self):
        db = MagicMock()
        with patch(
            "app.services.laximo.catalog_features.list_catalogs",
            return_value=[
                {"code": "AUDI2016", "features": ["vinsearch", "quickgroups"]},
                {"code": "MB2222", "features": [{"name": "vinsearch"}]},
            ],
        ):
            self.assertTrue(has_quickgroups(db, "AUDI2016"))
            self.assertFalse(has_quickgroups(db, "MB2222"))
            self.assertIn("quickgroups", get_catalog_features(db, "audi2016"))


class UnitTreeNormalizeTests(unittest.TestCase):
    def test_normalize_category(self):
        row = {
            "categoryId": "1",
            "name": "Engine",
            "ssd": "abc",
            "childrens": True,
            "parentCategoryId": "",
        }
        out = normalize_category(row)
        self.assertEqual(out["category_id"], "1")
        self.assertEqual(out["name"], "Engine")
        self.assertTrue(out["has_children"])
        self.assertEqual(out["ssd"], "abc")

    def test_normalize_detail_oem_name(self):
        row = {
            "oem": "8K0121451D",
            "name": "Air filter",
            "codeOnImage": "12",
            "filter": {"x": 1},
        }
        out = normalize_detail(row)
        self.assertEqual(out["oem"], "8K0121451D")
        self.assertEqual(out["name"], "Air filter")
        self.assertEqual(out["code_on_image"], "12")
        self.assertEqual(out["filter"], {"x": 1})


class UnitTreeGateTests(unittest.TestCase):
    def setUp(self):
        clear_unit_tree_cache()
        clear_catalog_features_cache()

    def tearDown(self):
        clear_unit_tree_cache()
        clear_catalog_features_cache()

    def test_gate_not_ready_does_not_call_cat(self):
        db = MagicMock()
        with patch(
            "app.services.laximo.unit_tree.laximo_cat_ready",
            return_value=False,
        ), patch(
            "app.services.laximo.unit_tree.cat_client.list_categories"
        ) as mock_cat:
            result = get_categories(
                db,
                catalog="AUDI",
                vehicle_id="1",
                ssd="token",
            )
            mock_cat.assert_not_called()
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, PUBLIC_TEMPORARILY_UNAVAILABLE)
        self.assertTrue(assert_public_message_safe(result.message or ""))

    def test_missing_ssd_session_expired_no_cat(self):
        db = MagicMock()
        with patch(
            "app.services.laximo.unit_tree.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.unit_tree.cat_client.list_categories"
        ) as mock_cat:
            result = get_categories(
                db,
                catalog="AUDI",
                vehicle_id="1",
                ssd="",
            )
            mock_cat.assert_not_called()
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, PUBLIC_SESSION_EXPIRED)
        self.assertEqual(result.message, PUBLIC_SESSION_MESSAGE)
        self.assertTrue(assert_public_message_safe(result.message))
        lowered = result.message.lower()
        for word in ("laximo", "ssd", "api", "квота", "лимит"):
            self.assertNotIn(word, lowered)

    def test_categories_success_quota_flag(self):
        db = MagicMock()
        rows = [{"categoryId": "1", "name": "Engine", "childrens": False, "ssd": "s1"}]
        with patch(
            "app.services.laximo.unit_tree.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.unit_tree.cat_client.list_categories",
            return_value=rows,
        ) as mock_cat:
            result = get_categories(
                db,
                catalog="AUDI",
                vehicle_id="42",
                ssd="token-ssd",
                category_id="-1",
            )
            mock_cat.assert_called_once()
            kwargs = mock_cat.call_args.kwargs
            self.assertTrue(kwargs.get("count_toward_quota"))
            self.assertEqual(kwargs.get("catalog"), "AUDI")
            self.assertEqual(kwargs.get("vehicle_id"), "42")
            self.assertEqual(kwargs.get("ssd"), "token-ssd")
        self.assertTrue(result.ok)
        self.assertEqual(len(result.payload["categories"]), 1)
        self.assertEqual(result.payload["categories"][0]["name"], "Engine")

    def test_units_and_details(self):
        db = MagicMock()
        with patch(
            "app.services.laximo.unit_tree.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.unit_tree.cat_client.list_units",
            return_value=[{"unitId": "u1", "name": "Filter"}],
        ) as mock_units:
            units = get_units(
                db, catalog="AUDI", vehicle_id="1", ssd="ssd", category_id="9"
            )
            mock_units.assert_called_once()
            self.assertTrue(mock_units.call_args.kwargs.get("count_toward_quota"))
        self.assertTrue(units.ok)
        self.assertEqual(units.payload["units"][0]["unit_id"], "u1")

        with patch(
            "app.services.laximo.unit_tree.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.unit_tree.cat_client.get_unit_info",
            return_value=[{"unitId": "u1", "name": "Filter", "imageUrl": "http://x/%size%/a.png"}],
        ), patch(
            "app.services.laximo.unit_tree.cat_client.list_detail_by_unit",
            return_value=[{"oem": "OEM1", "name": "Part A"}],
        ) as mock_det:
            details = get_unit_with_details(
                db, catalog="AUDI", vehicle_id="1", ssd="ssd", unit_id="u1"
            )
            self.assertTrue(mock_det.call_args.kwargs.get("count_toward_quota"))
        self.assertTrue(details.ok)
        self.assertEqual(details.payload["details"][0]["oem"], "OEM1")
        self.assertIn("250", details.payload["unit"]["image_url"])

    def test_features_with_and_without_quickgroups(self):
        db = MagicMock()
        with patch(
            "app.services.laximo.unit_tree.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.unit_tree.get_catalog_features",
            return_value={"vinsearch", "quickgroups"},
        ):
            ok = get_features(db, "AUDI")
        self.assertTrue(ok.ok)
        self.assertTrue(ok.payload["has_quickgroups"])

        with patch(
            "app.services.laximo.unit_tree.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.unit_tree.get_catalog_features",
            return_value={"vinsearch"},
        ):
            no = get_features(db, "MB")
        self.assertTrue(no.ok)
        self.assertFalse(no.payload["has_quickgroups"])


if __name__ == "__main__":
    unittest.main()
