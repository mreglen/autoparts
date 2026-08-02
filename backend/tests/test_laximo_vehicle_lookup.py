import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from app.services.laximo.gate import (
    PUBLIC_NOT_FOUND,
    PUBLIC_OK,
    PUBLIC_TEMPORARILY_UNAVAILABLE,
    PUBLIC_NOT_FOUND_MESSAGE,
    PUBLIC_UNAVAILABLE_MESSAGE,
    assert_public_message_safe,
)
from app.services.laximo.vehicle_lookup import (
    clear_find_vehicle_cache,
    lookup_by_vin,
)
from app.services.laximo.vehicle_normalize import normalize_find_vehicle_row
from app.services.laximo.vin import normalize_vin_or_raise


AUDI_LIKE_ROW = {
    "brand": "Audi",
    "name": "A4 (8K2, B8)",
    "catalog": "AUDI201601",
    "vehicleId": "12345",
    "ssd": "ssd-token-1",
    "sysProperties": {"filter_level": "1"},
    "attributes": [
        {"key": "model", "value": "A4", "name": "Модель"},
        {"key": "manufactured", "value": "2012", "name": "Год"},
        {"key": "engine", "value": "2.0 TDI", "name": "Двигатель"},
        {"key": "transmission", "value": "Manual", "name": "КПП"},
        {"key": "frame", "value": "Sedan", "name": "Кузов"},
        {"key": "framecolor", "value": "Black", "name": "Цвет"},
    ],
}

SPARSE_ROW = {
    "brand": "VW",
    "name": "Golf VII",
    "catalog": "VAG2018",
    "vehicleid": "99",
    "ssd": "ssd-2",
    "attributes": [
        {"key": "engine_info", "value": "1.4 TSI"},
    ],
}


class VinNormalizeTests(unittest.TestCase):
    def test_valid_vin(self):
        self.assertEqual(
            normalize_vin_or_raise("wba3a5c58cf123456"),
            "WBA3A5C58CF123456",
        )

    def test_invalid_length(self):
        with self.assertRaises(HTTPException) as ctx:
            normalize_vin_or_raise("SHORT")
        self.assertEqual(ctx.exception.status_code, 400)

    def test_forbidden_letters(self):
        with self.assertRaises(HTTPException) as ctx:
            normalize_vin_or_raise("WBA3A5C58CF12345I")
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("I, O или Q", ctx.exception.detail)


class VehicleNormalizeTests(unittest.TestCase):
    def test_audi_like_attributes(self):
        cand = normalize_find_vehicle_row(AUDI_LIKE_ROW)
        self.assertEqual(cand.make, "Audi")
        self.assertEqual(cand.model, "A4")
        self.assertEqual(cand.year, 2012)
        self.assertEqual(cand.engine, "2.0 TDI")
        self.assertEqual(cand.transmission, "Manual")
        self.assertEqual(cand.body, "Sedan")
        self.assertEqual(cand.color, "Black")
        self.assertEqual(cand.catalog, "AUDI201601")
        self.assertEqual(cand.vehicle_id, "12345")
        self.assertEqual(cand.ssd, "ssd-token-1")
        self.assertEqual(cand.filter_level, "1")
        self.assertEqual(cand.display_name, "Audi A4 (8K2, B8)")
        self.assertTrue(cand.attributes_raw)

    def test_sparse_attributes_model_from_name(self):
        cand = normalize_find_vehicle_row(SPARSE_ROW)
        self.assertEqual(cand.make, "VW")
        self.assertEqual(cand.model, "Golf VII")
        self.assertIsNone(cand.year)
        self.assertEqual(cand.engine, "1.4 TSI")
        self.assertIsNone(cand.transmission)
        self.assertIsNone(cand.body)
        self.assertIsNone(cand.color)
        self.assertEqual(cand.vehicle_id, "99")


class VehicleLookupTests(unittest.TestCase):
    def setUp(self):
        clear_find_vehicle_cache()

    def tearDown(self):
        clear_find_vehicle_cache()

    def test_gate_not_ready_does_not_call_find_vehicle(self):
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
        self.assertEqual(result.reason, PUBLIC_TEMPORARILY_UNAVAILABLE)
        self.assertEqual(result.message, PUBLIC_UNAVAILABLE_MESSAGE)
        self.assertTrue(assert_public_message_safe(result.message or ""))

    def test_empty_find_vehicle_not_found(self):
        db = MagicMock()
        with patch(
            "app.services.laximo.vehicle_lookup.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.vehicle_lookup.find_vehicle",
            return_value=[],
        ) as mock_find:
            result = lookup_by_vin(db, "WBA3A5C58CF123456")
            mock_find.assert_called_once_with(
                db, "WBA3A5C58CF123456", count_toward_quota=True
            )
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, PUBLIC_NOT_FOUND)
        self.assertEqual(result.message, PUBLIC_NOT_FOUND_MESSAGE)
        self.assertTrue(assert_public_message_safe(result.message or ""))

    def test_multi_rows_not_collapsed(self):
        db = MagicMock()
        rows = [AUDI_LIKE_ROW, SPARSE_ROW, {**AUDI_LIKE_ROW, "vehicleId": "3"}]
        with patch(
            "app.services.laximo.vehicle_lookup.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.vehicle_lookup.find_vehicle",
            return_value=rows,
        ) as mock_find:
            result = lookup_by_vin(db, "WBA3A5C58CF123456")
            mock_find.assert_called_once_with(
                db, "WBA3A5C58CF123456", count_toward_quota=True
            )
        self.assertTrue(result.ok)
        self.assertEqual(result.reason, PUBLIC_OK)
        self.assertIsNone(result.message)
        self.assertEqual(len(result.candidates), 3)

    def test_upstream_error_soft_fail(self):
        from app.services.laximo.cat_client import LaximoCatError

        db = MagicMock()
        with patch(
            "app.services.laximo.vehicle_lookup.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.vehicle_lookup.find_vehicle",
            side_effect=LaximoCatError("HTTP 401", status_code=401),
        ):
            result = lookup_by_vin(db, "WBA3A5C58CF123456")
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, PUBLIC_TEMPORARILY_UNAVAILABLE)
        self.assertNotIn("401", (result.message or "").lower())
        self.assertNotIn("laximo", (result.message or "").lower())
        self.assertTrue(assert_public_message_safe(result.message or ""))

    def test_public_messages_have_no_forbidden_words(self):
        self.assertTrue(assert_public_message_safe(PUBLIC_UNAVAILABLE_MESSAGE))
        self.assertTrue(assert_public_message_safe(PUBLIC_NOT_FOUND_MESSAGE))
        for word in ("laximo", "квота", "лимит", "api"):
            self.assertNotIn(word, PUBLIC_UNAVAILABLE_MESSAGE.lower())
            self.assertNotIn(word, PUBLIC_NOT_FOUND_MESSAGE.lower())


if __name__ == "__main__":
    unittest.main()
