import sys
import types
import unittest
from unittest.mock import MagicMock, patch

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

from fastapi import HTTPException

from app.services.laximo.cat_client import LaximoCatError
from app.services.laximo.gate import assert_public_message_safe
from app.services.laximo.plate import (
    looks_like_ru_plate,
    normalize_plate,
    normalize_plate_or_raise,
)
from app.services.laximo.vehicle_lookup import (
    ByVinResult,
    clear_plate_lookup_cache,
    lookup_by_plate,
)
from app.services.laximo.vehicle_normalize import (
    NormalizedVehicleCandidate,
    normalize_plate_full_card,
)


SAMPLE_PLATE_CARD = {
    "vin_number": "XUFTA69EJDN010376",
    "car_mark": "Chevrolet",
    "car_model": "Aveo",
    "manufacturing_year": "2013",
    "color": "Белый",
    "engine_model": "1.6 i",
    "car_type_string": "Легковые автомобили седан",
    "number_plate": "М460УН154",
}


class PlateNormalizeTests(unittest.TestCase):
    def test_latin_lookalikes(self):
        self.assertEqual(normalize_plate("a123bc77"), "А123ВС77")

    def test_strip_spaces(self):
        self.assertEqual(normalize_plate(" М 460 УН 154 "), "М460УН154")

    def test_looks_like(self):
        self.assertTrue(looks_like_ru_plate("М460УН154"))
        self.assertFalse(looks_like_ru_plate("AB"))

    def test_raise_invalid(self):
        with self.assertRaises(HTTPException) as ctx:
            normalize_plate_or_raise("!!")
        self.assertEqual(ctx.exception.status_code, 400)


class PlateFullNormalizeTests(unittest.TestCase):
    def test_card_to_candidate(self):
        cand = normalize_plate_full_card(SAMPLE_PLATE_CARD)
        self.assertIsNotNone(cand)
        self.assertEqual(cand.make, "Chevrolet")
        self.assertEqual(cand.model, "Aveo")
        self.assertEqual(cand.year, 2013)
        self.assertEqual(cand.color, "Белый")
        self.assertIsNone(cand.catalog)

    def test_empty_card(self):
        self.assertIsNone(normalize_plate_full_card({}))


class LookupByPlateTests(unittest.TestCase):
    def setUp(self):
        clear_plate_lookup_cache()

    def test_not_ready_skips_upstream(self):
        with patch(
            "app.services.laximo.vehicle_lookup.laximo_cat_ready",
            return_value=False,
        ), patch(
            "app.services.laximo.vehicle_lookup.identify_by_plate_number_full"
        ) as full_mock:
            result = lookup_by_plate(MagicMock(), "М460УН154")
        full_mock.assert_not_called()
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "temporarily_unavailable")
        self.assertTrue(assert_public_message_safe(result.message or ""))

    def test_full_plus_find_vehicle(self):
        cand = NormalizedVehicleCandidate(
            make="Chevrolet",
            model="Aveo",
            year=2013,
            catalog="CHEVROLET",
            vehicle_id="1",
        )
        with patch(
            "app.services.laximo.vehicle_lookup.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.vehicle_lookup.identify_by_plate_number_full",
            return_value=SAMPLE_PLATE_CARD,
        ) as full_mock, patch(
            "app.services.laximo.vehicle_lookup._lookup_vin_soft",
            return_value=ByVinResult(ok=True, reason="ok", candidates=[cand]),
        ):
            result = lookup_by_plate(MagicMock(), "м460ун154")

        full_mock.assert_called_once()
        kwargs = full_mock.call_args.kwargs
        self.assertTrue(kwargs.get("count_toward_quota"))
        self.assertTrue(result.ok)
        self.assertEqual(result.vin, "XUFTA69EJDN010376")
        self.assertEqual(result.plate, "М460УН154")
        self.assertEqual(result.candidates[0].catalog, "CHEVROLET")
        self.assertEqual(result.candidates[0].color, "Белый")

    def test_empty_full_not_found(self):
        with patch(
            "app.services.laximo.vehicle_lookup.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.vehicle_lookup.identify_by_plate_number_full",
            return_value={},
        ):
            result = lookup_by_plate(MagicMock(), "М460УН154")
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "not_found")

    def test_find_vehicle_fail_uses_fallback(self):
        with patch(
            "app.services.laximo.vehicle_lookup.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.vehicle_lookup.identify_by_plate_number_full",
            return_value=SAMPLE_PLATE_CARD,
        ), patch(
            "app.services.laximo.vehicle_lookup._lookup_vin_soft",
            return_value=ByVinResult(
                ok=False,
                reason="temporarily_unavailable",
                message="x",
                candidates=[],
            ),
        ):
            result = lookup_by_plate(MagicMock(), "М460УН154")
        self.assertTrue(result.ok)
        self.assertEqual(result.candidates[0].make, "Chevrolet")
        self.assertIsNone(result.candidates[0].catalog)

    def test_upstream_error_soft(self):
        with patch(
            "app.services.laximo.vehicle_lookup.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.vehicle_lookup.identify_by_plate_number_full",
            side_effect=LaximoCatError("HTTP 500"),
        ):
            result = lookup_by_plate(MagicMock(), "М460УН154")
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "temporarily_unavailable")
        lowered = (result.message or "").lower()
        self.assertNotIn("laximo", lowered)
        self.assertNotIn("квота", lowered)

    def test_upstream_404_not_found(self):
        with patch(
            "app.services.laximo.vehicle_lookup.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.vehicle_lookup.identify_by_plate_number_full",
            side_effect=LaximoCatError("HTTP 404", status_code=404),
        ):
            result = lookup_by_plate(MagicMock(), "М460УН154")
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "not_found")


class GarageDecodePlateTests(unittest.TestCase):
    def test_decode_plate_maps_lookup(self):
        from app.routers.autoservice_garage import decode_garage_plate
        from app.schemas.garage_vehicle import GarageVehicleDecodePlateRequest
        from app.services.laximo.vehicle_lookup import ByPlateResult

        cand = NormalizedVehicleCandidate(make="Nissan", model="X-Trail", year=2019)
        lookup = ByPlateResult(
            ok=True,
            reason="ok",
            plate="Н678ОК154",
            vin="Z8NTBNT32ES101269",
            candidates=[cand],
        )
        with patch(
            "app.routers.autoservice_garage.require_my_active_autoservice_client"
        ), patch(
            "app.routers.autoservice_garage.lookup_by_plate",
            return_value=lookup,
        ) as mock_lookup:
            resp = decode_garage_plate(
                GarageVehicleDecodePlateRequest(plate="Н678ОК154"),
                db=MagicMock(),
                current_user=MagicMock(),
            )
        mock_lookup.assert_called_once()
        self.assertTrue(resp.ok)
        self.assertEqual(resp.vin, "Z8NTBNT32ES101269")
        self.assertEqual(resp.candidates[0].make, "Nissan")

    def test_invalid_plate_400(self):
        from app.routers.autoservice_garage import decode_garage_plate
        from app.schemas.garage_vehicle import GarageVehicleDecodePlateRequest

        with patch(
            "app.routers.autoservice_garage.require_my_active_autoservice_client"
        ):
            with self.assertRaises(HTTPException) as ctx:
                decode_garage_plate(
                    GarageVehicleDecodePlateRequest(plate="!!"),
                    db=MagicMock(),
                    current_user=MagicMock(),
                )
            self.assertEqual(ctx.exception.status_code, 400)


class PlateSourceTests(unittest.TestCase):
    def test_resolve_source_plate(self):
        from app.routers.autoservice_garage import _resolve_source_and_laximo
        from app.schemas.garage_vehicle import GarageVehicleCreate

        payload = GarageVehicleCreate(
            make="Chevrolet",
            model="Aveo",
            source="plate",
            plate="М460УН154",
        )
        source, catalog, vid, attrs = _resolve_source_and_laximo(payload)
        self.assertEqual(source, "plate")
        self.assertIsNone(catalog)


if __name__ == "__main__":
    unittest.main()
