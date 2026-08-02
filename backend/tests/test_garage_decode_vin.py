import sys
import types
import unittest
from unittest.mock import MagicMock, patch

# deploy_update_service imports fcntl (Unix-only); stub for Windows unit tests
if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

from fastapi import HTTPException

from app.schemas.garage_vehicle import GarageVehicleCreate
from app.services.laximo.vehicle_lookup import ByVinResult
from app.services.laximo.vehicle_normalize import NormalizedVehicleCandidate
from app.services.laximo.vin import normalize_vin_or_raise


class GarageDecodeVinTests(unittest.TestCase):
    def test_decode_maps_lookup_ok(self):
        from app.routers.autoservice_garage import decode_garage_vin
        from app.schemas.garage_vehicle import GarageVehicleDecodeVinRequest

        cand = NormalizedVehicleCandidate(
            make="Audi",
            model="A4",
            year=2012,
            catalog="AUDI",
            vehicle_id="1",
        )
        lookup = ByVinResult(ok=True, reason="ok", message=None, candidates=[cand])
        db = MagicMock()
        user = MagicMock()
        with patch(
            "app.routers.autoservice_garage.require_my_active_autoservice_client"
        ), patch(
            "app.routers.autoservice_garage.lookup_by_vin",
            return_value=lookup,
        ) as mock_lookup:
            resp = decode_garage_vin(
                GarageVehicleDecodeVinRequest(vin="WBA3A5C58CF123456"),
                db=db,
                current_user=user,
            )
            mock_lookup.assert_called_once()
        self.assertTrue(resp.ok)
        self.assertEqual(resp.reason, "ok")
        self.assertEqual(len(resp.candidates), 1)
        self.assertEqual(resp.candidates[0].make, "Audi")

    def test_decode_not_found(self):
        from app.routers.autoservice_garage import decode_garage_vin
        from app.schemas.garage_vehicle import GarageVehicleDecodeVinRequest

        lookup = ByVinResult(
            ok=False,
            reason="not_found",
            message="Не удалось определить автомобиль по этому VIN. Проверьте номер или заполните поля вручную.",
            candidates=[],
        )
        with patch(
            "app.routers.autoservice_garage.require_my_active_autoservice_client"
        ), patch(
            "app.routers.autoservice_garage.lookup_by_vin",
            return_value=lookup,
        ):
            resp = decode_garage_vin(
                GarageVehicleDecodeVinRequest(vin="WBA3A5C58CF123456"),
                db=MagicMock(),
                current_user=MagicMock(),
            )
        self.assertFalse(resp.ok)
        self.assertEqual(resp.reason, "not_found")
        self.assertTrue(resp.message)

    def test_decode_temporarily_unavailable(self):
        from app.routers.autoservice_garage import decode_garage_vin
        from app.schemas.garage_vehicle import GarageVehicleDecodeVinRequest

        lookup = ByVinResult(
            ok=False,
            reason="temporarily_unavailable",
            message="Простите, сейчас поиск автомобиля по VIN временно не работает. Попробуйте позже или заполните данные вручную.",
            candidates=[],
        )
        with patch(
            "app.routers.autoservice_garage.require_my_active_autoservice_client"
        ), patch(
            "app.routers.autoservice_garage.lookup_by_vin",
            return_value=lookup,
        ):
            resp = decode_garage_vin(
                GarageVehicleDecodeVinRequest(vin="WBA3A5C58CF123456"),
                db=MagicMock(),
                current_user=MagicMock(),
            )
        self.assertFalse(resp.ok)
        self.assertEqual(resp.reason, "temporarily_unavailable")
        lowered = (resp.message or "").lower()
        self.assertNotIn("laximo", lowered)
        self.assertNotIn("квота", lowered)
        self.assertNotIn("лимит", lowered)

    def test_invalid_vin_400(self):
        from app.routers.autoservice_garage import decode_garage_vin
        from app.schemas.garage_vehicle import GarageVehicleDecodeVinRequest

        with patch(
            "app.routers.autoservice_garage.require_my_active_autoservice_client"
        ), patch(
            "app.routers.autoservice_garage.lookup_by_vin",
            side_effect=lambda db, vin: normalize_vin_or_raise(vin),
        ):
            with self.assertRaises(HTTPException) as ctx:
                decode_garage_vin(
                    GarageVehicleDecodeVinRequest(vin="SHORT"),
                    db=MagicMock(),
                    current_user=MagicMock(),
                )
            self.assertEqual(ctx.exception.status_code, 400)


class GarageCreateLaximoTests(unittest.TestCase):
    def test_create_with_laximo_fields_sets_source(self):
        from app.routers import autoservice_garage as garage

        client = MagicMock()
        client.id = 10
        client.organization_id = "ORG1"
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        payload = GarageVehicleCreate(
            make="Audi",
            model="A4",
            year=2012,
            vin="WBA3A5C58CF123456",
            source="laximo",
            laximo_catalog="AUDI2016",
            laximo_vehicle_id="42",
            laximo_attributes=[{"key": "model", "value": "A4"}],
        )

        source, catalog, vid, attrs = garage._resolve_source_and_laximo(payload)
        self.assertEqual(source, "laximo")
        self.assertEqual(catalog, "AUDI2016")
        self.assertEqual(vid, "42")
        self.assertEqual(attrs, [{"key": "model", "value": "A4"}])

        manual = GarageVehicleCreate(make="VW", model="Golf")
        source2, catalog2, vid2, attrs2 = garage._resolve_source_and_laximo(manual)
        self.assertEqual(source2, "manual")
        self.assertIsNone(catalog2)
        self.assertIsNone(vid2)
        self.assertIsNone(attrs2)

    def test_create_vehicle_persists_laximo(self):
        from app.routers.autoservice_garage import _create_vehicle_for_client

        client = MagicMock()
        client.id = 7
        client.organization_id = "ORG7"
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        stored = {}

        def add(row):
            stored["row"] = row

        db.add.side_effect = add

        payload = GarageVehicleCreate(
            make="Audi",
            model="A4",
            year=2012,
            vin="WBA3A5C58CF123456",
            laximo_catalog="AUDI2016",
            laximo_vehicle_id="99",
            laximo_attributes=[{"key": "engine", "value": "2.0"}],
        )
        row = _create_vehicle_for_client(db, client=client, payload=payload)
        self.assertIs(row, stored["row"])
        self.assertEqual(row.source, "laximo")
        self.assertEqual(row.laximo_catalog, "AUDI2016")
        self.assertEqual(row.laximo_vehicle_id, "99")
        self.assertEqual(row.make, "Audi")
        self.assertEqual(row.vin, "WBA3A5C58CF123456")
        db.commit.assert_called_once()


if __name__ == "__main__":
    unittest.main()
