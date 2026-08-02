import sys
import types
import unittest
from unittest.mock import MagicMock, patch

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

from fastapi import HTTPException

from app.services.laximo.cat_client import LaximoCatError
from app.services.laximo.frame import (
    looks_like_frame,
    normalize_frame,
    normalize_frame_or_raise,
)
from app.services.laximo.gate import assert_public_message_safe
from app.services.laximo.vehicle_lookup import clear_frame_lookup_cache, lookup_by_frame


SAMPLE_FRAME_ROW = {
    "catalog": "MAZDA2020",
    "brand": "MAZDA",
    "name": "BONGO FRIENDEE",
    "vehicleId": "1416555446",
    "ssd": "ssd-token",
    "attributes": [
        {"key": "manufactured", "value": "2001", "name": "Manufactured"},
        {"key": "engine", "value": "DIESEL", "name": "Engine"},
        {"key": "bodyStyle", "value": "WAGON", "name": "bodyStyle"},
    ],
    "sysProperties": {"filter_level": "full"},
}


class FrameNormalizeTests(unittest.TestCase):
    def test_keep_hyphen_upper(self):
        self.assertEqual(normalize_frame(" sgl5-400683 "), "SGL5-400683")

    def test_strip_spaces(self):
        self.assertEqual(normalize_frame("XZU 423 0001026"), "XZU4230001026")

    def test_looks_like(self):
        self.assertTrue(looks_like_frame("SGL5-400683"))
        self.assertFalse(looks_like_frame("AB"))

    def test_raise_short(self):
        with self.assertRaises(HTTPException) as ctx:
            normalize_frame_or_raise("AB")
        self.assertEqual(ctx.exception.status_code, 400)

    def test_raise_empty(self):
        with self.assertRaises(HTTPException) as ctx:
            normalize_frame_or_raise("")
        self.assertEqual(ctx.exception.status_code, 400)


class LookupByFrameTests(unittest.TestCase):
    def setUp(self):
        clear_frame_lookup_cache()

    def test_not_ready_skips_http(self):
        with patch(
            "app.services.laximo.vehicle_lookup.laximo_cat_ready",
            return_value=False,
        ), patch(
            "app.services.laximo.vehicle_lookup.find_vehicle"
        ) as fv:
            result = lookup_by_frame(MagicMock(), "SGL5-400683")
        fv.assert_not_called()
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "temporarily_unavailable")
        self.assertEqual(result.frame, "SGL5-400683")
        self.assertTrue(assert_public_message_safe(result.message or ""))

    def test_mock_find_vehicle_ok(self):
        with patch(
            "app.services.laximo.vehicle_lookup.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.vehicle_lookup.find_vehicle",
            return_value=[SAMPLE_FRAME_ROW],
        ) as fv:
            result = lookup_by_frame(MagicMock(), "sgl5-400683")
        fv.assert_called_once()
        self.assertTrue(fv.call_args.kwargs.get("count_toward_quota"))
        self.assertEqual(fv.call_args.args[1], "SGL5-400683")
        self.assertTrue(result.ok)
        self.assertEqual(result.frame, "SGL5-400683")
        self.assertEqual(len(result.candidates), 1)
        self.assertEqual(result.candidates[0].make, "MAZDA")

    def test_empty_not_found(self):
        with patch(
            "app.services.laximo.vehicle_lookup.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.vehicle_lookup.find_vehicle",
            return_value=[],
        ):
            result = lookup_by_frame(MagicMock(), "SGL5-400683")
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "not_found")
        self.assertTrue(assert_public_message_safe(result.message or ""))

    def test_upstream_soft(self):
        with patch(
            "app.services.laximo.vehicle_lookup.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.vehicle_lookup.find_vehicle",
            side_effect=LaximoCatError("HTTP 403"),
        ):
            result = lookup_by_frame(MagicMock(), "SGL5-400683")
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "temporarily_unavailable")
        self.assertTrue(assert_public_message_safe(result.message or ""))


if __name__ == "__main__":
    unittest.main()
