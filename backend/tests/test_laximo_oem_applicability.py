import unittest
from unittest.mock import MagicMock, patch

from app.services.laximo.cat_client import LaximoCatError
from app.services.laximo.gate import assert_public_message_safe
from app.services.laximo.oem_applicability import (
    clear_oem_applicability_cache,
    lookup_applicable_vehicles,
    lookup_oem_on_vehicle,
)


class ApplicableVehiclesTests(unittest.TestCase):
    def setUp(self):
        clear_oem_applicability_cache()

    def test_not_ready_skips_http(self):
        with patch(
            "app.services.laximo.oem_applicability.laximo_cat_ready",
            return_value=False,
        ), patch(
            "app.services.laximo.oem_applicability.cat_client.find_part_references"
        ) as refs:
            result = lookup_applicable_vehicles(MagicMock(), oem="0913128000")
        refs.assert_not_called()
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "temporarily_unavailable")
        self.assertTrue(assert_public_message_safe(result.message or ""))

    def test_mock_refs_and_fav(self):
        with patch(
            "app.services.laximo.oem_applicability.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.oem_applicability.cat_client.find_part_references",
            return_value=[
                {"code": "HYUNDAI202404", "brand": "HYUNDAI", "name": "Hyundai"},
            ],
        ) as refs, patch(
            "app.services.laximo.oem_applicability.has_detailapplicability",
            return_value=True,
        ), patch(
            "app.services.laximo.oem_applicability.cat_client.find_applicable_vehicles",
            return_value=[
                {
                    "catalog": "HYUNDAI202404",
                    "brand": "HYUNDAI",
                    "name": "EXCEL 94 (1995-1999)",
                    "vehicle_id": "463808855",
                    "attributes": [
                        {"key": "modelyearfrom", "value": "1994"},
                        {"key": "modelyearto", "value": "1999"},
                    ],
                }
            ],
        ) as fav:
            result = lookup_applicable_vehicles(
                MagicMock(), oem="0913128000", brand="HYUNDAI"
            )
        refs.assert_called_once()
        self.assertTrue(refs.call_args.kwargs.get("count_toward_quota"))
        fav.assert_called_once()
        self.assertTrue(fav.call_args.kwargs.get("count_toward_quota"))
        self.assertTrue(result.ok)
        self.assertEqual(len(result.payload["vehicles"]), 1)
        self.assertEqual(result.payload["vehicles"][0]["brand"], "HYUNDAI")
        self.assertEqual(result.payload["vehicles"][0]["year_from"], "1994")

    def test_no_detailapplicability_skips_fav(self):
        with patch(
            "app.services.laximo.oem_applicability.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.oem_applicability.cat_client.find_part_references",
            return_value=[
                {"code": "AU1587", "brand": "AUDI", "name": "Audi"},
            ],
        ), patch(
            "app.services.laximo.oem_applicability.has_detailapplicability",
            return_value=False,
        ), patch(
            "app.services.laximo.oem_applicability.cat_client.find_applicable_vehicles"
        ) as fav:
            result = lookup_applicable_vehicles(MagicMock(), oem="0913128000")
        fav.assert_not_called()
        self.assertTrue(result.ok)
        self.assertEqual(result.payload["vehicles"], [])

    def test_upstream_fail_soft(self):
        with patch(
            "app.services.laximo.oem_applicability.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.oem_applicability.cat_client.find_part_references",
            side_effect=LaximoCatError("HTTP 403"),
        ):
            result = lookup_applicable_vehicles(MagicMock(), oem="0913128000")
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "temporarily_unavailable")
        self.assertTrue(assert_public_message_safe(result.message or ""))

    def test_empty_refs_ok(self):
        with patch(
            "app.services.laximo.oem_applicability.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.oem_applicability.cat_client.find_part_references",
            return_value=[],
        ), patch(
            "app.services.laximo.oem_applicability.cat_client.find_applicable_vehicles"
        ) as fav:
            result = lookup_applicable_vehicles(MagicMock(), oem="0913128000")
        fav.assert_not_called()
        self.assertTrue(result.ok)
        self.assertEqual(result.payload["vehicles"], [])


class OemOnVehicleTests(unittest.TestCase):
    def setUp(self):
        clear_oem_applicability_cache()

    def test_get_oem_applicability_fully(self):
        with patch(
            "app.services.laximo.oem_applicability.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.oem_applicability.has_detailapplicability",
            return_value=True,
        ), patch(
            "app.services.laximo.oem_applicability.cat_client.get_oem_part_applicability",
            return_value={
                "applicability": "FULLY",
                "categories": [],
                "units": [
                    {"unit_id": "10", "code": "U1", "name": "Filter"},
                ],
            },
        ) as goa:
            result = lookup_oem_on_vehicle(
                MagicMock(),
                catalog="HYUNDAI202404",
                ssd="ssd-token",
                oem="0913128000",
            )
        goa.assert_called_once()
        self.assertTrue(goa.call_args.kwargs.get("count_toward_quota"))
        self.assertTrue(result.ok)
        self.assertEqual(result.payload["applicability"], "FULLY")
        self.assertEqual(result.payload["units"][0]["name"], "Filter")

    def test_missing_ssd_soft(self):
        with patch(
            "app.services.laximo.oem_applicability.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.oem_applicability.cat_client.get_oem_part_applicability"
        ) as goa:
            result = lookup_oem_on_vehicle(
                MagicMock(),
                catalog="HYUNDAI202404",
                ssd="",
                oem="0913128000",
            )
        goa.assert_not_called()
        self.assertFalse(result.ok)


class ClientParseTests(unittest.TestCase):
    def test_find_part_references_parses_catalogs(self):
        from app.services.laximo import cat_client

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b'[{"oem":"0913128000","catalogs":[{"code":"HYUNDAI202404","brand":"HYUNDAI","name":"Hyundai"}]}]'
        mock_response.json.return_value = [
            {
                "oem": "0913128000",
                "catalogs": [
                    {"code": "HYUNDAI202404", "brand": "HYUNDAI", "name": "Hyundai"},
                ],
            }
        ]

        with patch.object(
            cat_client,
            "_resolve_credentials",
            return_value=("u", "p", "https://ws.laximo.ru/restApi/v1"),
        ), patch(
            "app.services.laximo.cat_client.increment_laximo_request_counter"
        ), patch("httpx.Client") as client_cls:
            client = MagicMock()
            client.__enter__.return_value = client
            client.__exit__.return_value = False
            client.post.return_value = mock_response
            client_cls.return_value = client
            rows = cat_client.find_part_references(
                MagicMock(), oem="0913128000", count_toward_quota=True
            )
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["code"], "HYUNDAI202404")

    def test_short_oem_schema_rejects(self):
        from pydantic import ValidationError

        from app.schemas.laximo_catalog import (
            ApplicableVehiclesRequest,
            OemApplicabilityRequest,
        )

        with self.assertRaises(ValidationError):
            ApplicableVehiclesRequest(oem="1")
        with self.assertRaises(ValidationError):
            OemApplicabilityRequest(catalog="X", ssd="ssd", oem="1")


if __name__ == "__main__":
    unittest.main()
