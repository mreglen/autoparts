import sys
import types
import unittest
from unittest.mock import MagicMock, patch

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

from pydantic import ValidationError

from app.schemas.laximo_catalog import WizardStepRequest, WizardVehiclesRequest
from app.services.laximo.cat_client import LaximoCatError
from app.services.laximo.gate import assert_public_message_safe
from app.services.laximo.wizard import (
    clear_wizard_cache,
    find_by_wizard,
    get_wizard_step,
    list_catalogs_for_wizard,
)


SAMPLE_CONDITIONS = [
    {
        "condition_id": "1",
        "name": "Model",
        "determined": False,
        "automatic": False,
        "value": None,
        "ssd": None,
        "allow_list_vehicles": False,
        "options": [
            {"key": "ssd-model-a", "value": "Model A"},
            {"key": "ssd-model-b", "value": "Model B"},
        ],
    }
]

SAMPLE_VEHICLE_ROW = {
    "catalog": "AU1587",
    "brand": "AUDI",
    "name": "A4",
    "vehicleId": "123",
    "ssd": "ssd-final",
    "attributes": [],
}


class WizardCatalogsTests(unittest.TestCase):
    def test_not_ready_skips_list(self):
        with patch(
            "app.services.laximo.wizard.laximo_cat_ready",
            return_value=False,
        ), patch(
            "app.services.laximo.wizard.list_wizard_catalogs"
        ) as lst:
            result = list_catalogs_for_wizard(MagicMock())
        lst.assert_not_called()
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "temporarily_unavailable")
        self.assertTrue(assert_public_message_safe(result.message or ""))

    def test_ok_empty_catalogs(self):
        with patch(
            "app.services.laximo.wizard.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.wizard.list_wizard_catalogs",
            return_value=[],
        ):
            result = list_catalogs_for_wizard(MagicMock())
        self.assertTrue(result.ok)
        self.assertEqual(result.payload["catalogs"], [])


class WizardStepTests(unittest.TestCase):
    def setUp(self):
        clear_wizard_cache()

    def test_not_ready_skips_http(self):
        with patch(
            "app.services.laximo.wizard.laximo_cat_ready",
            return_value=False,
        ), patch(
            "app.services.laximo.wizard.cat_client.get_wizard2"
        ) as gw:
            result = get_wizard_step(MagicMock(), catalog="AU1587", ssd="")
        gw.assert_not_called()
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "temporarily_unavailable")
        self.assertTrue(assert_public_message_safe(result.message or ""))

    def test_no_feature_skips_http(self):
        with patch(
            "app.services.laximo.wizard.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.wizard.has_wizardsearch2",
            return_value=False,
        ), patch(
            "app.services.laximo.wizard.cat_client.get_wizard2"
        ) as gw:
            result = get_wizard_step(MagicMock(), catalog="AU1587", ssd="")
        gw.assert_not_called()
        self.assertTrue(result.ok)
        self.assertEqual(result.payload["conditions"], [])
        self.assertFalse(result.payload["can_list_vehicles"])

    def test_mock_get_wizard2(self):
        with patch(
            "app.services.laximo.wizard.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.wizard.has_wizardsearch2",
            return_value=True,
        ), patch(
            "app.services.laximo.wizard.cat_client.get_wizard2",
            return_value=SAMPLE_CONDITIONS,
        ) as gw:
            result = get_wizard_step(MagicMock(), catalog="AU1587", ssd="")
        gw.assert_called_once()
        self.assertTrue(gw.call_args.kwargs.get("count_toward_quota"))
        self.assertTrue(result.ok)
        self.assertEqual(len(result.payload["conditions"]), 1)
        self.assertEqual(
            result.payload["conditions"][0]["options"][0]["value"], "Model A"
        )

    def test_upstream_fail_soft(self):
        with patch(
            "app.services.laximo.wizard.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.wizard.has_wizardsearch2",
            return_value=True,
        ), patch(
            "app.services.laximo.wizard.cat_client.get_wizard2",
            side_effect=LaximoCatError("HTTP 403"),
        ):
            result = get_wizard_step(MagicMock(), catalog="AU1587", ssd="x")
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "temporarily_unavailable")
        self.assertTrue(assert_public_message_safe(result.message or ""))

    def test_empty_catalog_message(self):
        with patch(
            "app.services.laximo.wizard.laximo_cat_ready",
            return_value=True,
        ):
            result = get_wizard_step(MagicMock(), catalog="  ", ssd="")
        self.assertFalse(result.ok)
        self.assertIn("каталог", (result.message or "").lower())


class WizardVehiclesTests(unittest.TestCase):
    def test_not_ready_skips_http(self):
        with patch(
            "app.services.laximo.wizard.laximo_cat_ready",
            return_value=False,
        ), patch(
            "app.services.laximo.wizard.cat_client.find_vehicle_by_wizard2"
        ) as fv:
            result = find_by_wizard(MagicMock(), catalog="AU1587", ssd="ssd")
        fv.assert_not_called()
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "temporarily_unavailable")

    def test_no_feature_empty_candidates(self):
        with patch(
            "app.services.laximo.wizard.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.wizard.has_wizardsearch2",
            return_value=False,
        ), patch(
            "app.services.laximo.wizard.cat_client.find_vehicle_by_wizard2"
        ) as fv:
            result = find_by_wizard(MagicMock(), catalog="AU1587", ssd="ssd")
        fv.assert_not_called()
        self.assertTrue(result.ok)
        self.assertEqual(result.payload["candidates"], [])

    def test_mock_find_vehicles(self):
        with patch(
            "app.services.laximo.wizard.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.wizard.has_wizardsearch2",
            return_value=True,
        ), patch(
            "app.services.laximo.wizard.cat_client.find_vehicle_by_wizard2",
            return_value=[SAMPLE_VEHICLE_ROW],
        ) as fv:
            result = find_by_wizard(MagicMock(), catalog="AU1587", ssd="ssd-final")
        fv.assert_called_once()
        self.assertTrue(fv.call_args.kwargs.get("count_toward_quota"))
        self.assertTrue(result.ok)
        self.assertEqual(len(result.payload["candidates"]), 1)
        self.assertEqual(result.payload["candidates"][0]["vehicle_id"], "123")

    def test_empty_rows_not_found(self):
        with patch(
            "app.services.laximo.wizard.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.wizard.has_wizardsearch2",
            return_value=True,
        ), patch(
            "app.services.laximo.wizard.cat_client.find_vehicle_by_wizard2",
            return_value=[],
        ):
            result = find_by_wizard(MagicMock(), catalog="AU1587", ssd="ssd")
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "not_found")
        self.assertTrue(assert_public_message_safe(result.message or ""))

    def test_missing_ssd_soft(self):
        with patch(
            "app.services.laximo.wizard.laximo_cat_ready",
            return_value=True,
        ):
            result = find_by_wizard(MagicMock(), catalog="AU1587", ssd="")
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "temporarily_unavailable")


class WizardSchemaTests(unittest.TestCase):
    def test_empty_catalog_rejected(self):
        with self.assertRaises(ValidationError):
            WizardStepRequest(catalog="", ssd="")
        with self.assertRaises(ValidationError):
            WizardVehiclesRequest(catalog="AU", ssd="")


if __name__ == "__main__":
    unittest.main()
