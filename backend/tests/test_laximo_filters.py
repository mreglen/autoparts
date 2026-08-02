import unittest
from unittest.mock import MagicMock, patch

from app.services.laximo.cat_client import LaximoCatError
from app.services.laximo.gate import assert_public_message_safe
from app.services.laximo.unit_tree import (
    apply_filter_ssd,
    clear_unit_tree_cache,
    get_unit_filters,
    normalize_unit,
)


class FilterByUnitTests(unittest.TestCase):
    def setUp(self):
        clear_unit_tree_cache()

    def test_not_ready_skips_http(self):
        with patch(
            "app.services.laximo.unit_tree.laximo_cat_ready",
            return_value=False,
        ), patch(
            "app.services.laximo.unit_tree.cat_client.get_filter_by_unit"
        ) as gf:
            result = get_unit_filters(
                MagicMock(),
                catalog="BMW202501",
                vehicle_id="0",
                ssd="ssd-base",
                unit_id="380049079",
                filter_code="44761",
            )
        gf.assert_not_called()
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "temporarily_unavailable")
        self.assertTrue(assert_public_message_safe(result.message or ""))

    def test_mock_by_unit_conditions(self):
        with patch(
            "app.services.laximo.unit_tree.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.unit_tree.cat_client.get_filter_by_unit",
            return_value=[
                {
                    "name": "Climate",
                    "type": "list",
                    "regexp": None,
                    "ssd_modification": None,
                    "values": [
                        {"name": "Yes", "note": None, "ssd_modification": "~YES$"},
                        {"name": "No", "note": None, "ssd_modification": "~NO$"},
                    ],
                }
            ],
        ) as gf:
            result = get_unit_filters(
                MagicMock(),
                catalog="BMW202501",
                vehicle_id="0",
                ssd="ssd-base",
                unit_id="380049079",
                filter_code="44761",
            )
        gf.assert_called_once()
        self.assertTrue(gf.call_args.kwargs.get("count_toward_quota"))
        self.assertTrue(result.ok)
        self.assertEqual(len(result.payload["conditions"]), 1)
        self.assertEqual(result.payload["conditions"][0]["values"][0]["name"], "Yes")

    def test_upstream_fail_soft(self):
        with patch(
            "app.services.laximo.unit_tree.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.unit_tree.cat_client.get_filter_by_unit",
            side_effect=LaximoCatError("HTTP 403"),
        ):
            result = get_unit_filters(
                MagicMock(),
                catalog="BMW202501",
                vehicle_id="0",
                ssd="ssd-base",
                unit_id="380049079",
                filter_code="44761",
            )
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "temporarily_unavailable")
        self.assertTrue(assert_public_message_safe(result.message or ""))

    def test_missing_ctx_session_expired(self):
        with patch(
            "app.services.laximo.unit_tree.laximo_cat_ready",
            return_value=True,
        ):
            result = get_unit_filters(
                MagicMock(),
                catalog="BMW202501",
                vehicle_id="",
                ssd="",
                unit_id="1",
                filter_code="44761",
            )
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "session_expired")


class ApplyFilterSsdTests(unittest.TestCase):
    def test_apply_list_append(self):
        result = apply_filter_ssd(ssd="BASE", ssd_modification="~YES$")
        self.assertTrue(result.ok)
        self.assertEqual(result.payload["ssd"], "BASE~YES$")

    def test_apply_input_replace_then_append(self):
        result = apply_filter_ssd(
            ssd="BASE",
            ssd_modification="~z@$MAR%$",
            value="BOSCH",
        )
        self.assertTrue(result.ok)
        self.assertEqual(result.payload["ssd"], "BASE~z@BOSCHMAR%BOSCH")

    def test_apply_missing_returns_session(self):
        result = apply_filter_ssd(ssd="", ssd_modification="~x")
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "session_expired")


class NormalizeUnitFilterTests(unittest.TestCase):
    def test_unit_includes_filter(self):
        row = normalize_unit(
            {"unitId": "1", "name": "Engine", "filter": "44761", "ssd": "s"}
        )
        self.assertEqual(row["filter"], "44761")
        self.assertEqual(row["unit_id"], "1")

    def test_unit_without_filter(self):
        row = normalize_unit({"unitId": "1", "name": "Engine"})
        self.assertIsNone(row["filter"])


class SchemaTests(unittest.TestCase):
    def test_short_filter_rejected(self):
        from pydantic import ValidationError

        from app.schemas.laximo_catalog import FilterApplyRequest, FilterByUnitRequest

        with self.assertRaises(ValidationError):
            FilterByUnitRequest(
                catalog="X",
                vehicle_id="0",
                ssd="s",
                unit_id="1",
                filter="",
            )
        with self.assertRaises(ValidationError):
            FilterApplyRequest(ssd="BASE", ssd_modification="")


if __name__ == "__main__":
    unittest.main()
