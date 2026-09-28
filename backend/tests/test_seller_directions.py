import unittest
from unittest.mock import MagicMock

from pydantic import ValidationError

from app.models.autoservice_tariff_application import AutoserviceTariffApplication
from app.models.pending_seller import PendingSeller
from app.routers.admin import (
    _application_requested_flags,
    _pending_seller_wants,
    _serialize_pending_seller,
)
from app.routers.autoservice_applications import _requested_flags
from app.schemas.pending_seller import SellerRegisterRequest


def _register_payload(**overrides):
    data = {
        "last_name": "Иванов",
        "first_name": "Иван",
        "name_organization": "ООО Тест",
        "address_organization": "ул. Тестовая, 1",
        "phone": "+79990001122",
        "email": "test@example.com",
    }
    data.update(overrides)
    return data


class SellerRegisterRequestTests(unittest.TestCase):
    def test_legacy_payload_defaults_to_seller(self):
        req = SellerRegisterRequest(**_register_payload())
        self.assertTrue(req.wants_seller)
        self.assertFalse(req.wants_autoservice)

    def test_autoservice_only_allowed(self):
        req = SellerRegisterRequest(
            **_register_payload(wants_seller=False, wants_autoservice=True)
        )
        self.assertFalse(req.wants_seller)
        self.assertTrue(req.wants_autoservice)

    def test_both_directions_allowed(self):
        req = SellerRegisterRequest(
            **_register_payload(wants_seller=True, wants_autoservice=True)
        )
        self.assertTrue(req.wants_seller)
        self.assertTrue(req.wants_autoservice)

    def test_no_direction_rejected(self):
        with self.assertRaises(ValidationError):
            SellerRegisterRequest(
                **_register_payload(wants_seller=False, wants_autoservice=False)
            )


class PendingSellerWantsTests(unittest.TestCase):
    def test_legacy_row_defaults_to_seller(self):
        row = MagicMock(spec=PendingSeller)
        row.wants_seller = None
        row.wants_autoservice = None

        wants_seller, wants_autoservice = _pending_seller_wants(row)

        self.assertTrue(wants_seller)
        self.assertFalse(wants_autoservice)

    def test_flags_passed_through(self):
        row = MagicMock(spec=PendingSeller)
        row.wants_seller = False
        row.wants_autoservice = True

        self.assertEqual(_pending_seller_wants(row), (False, True))

    def test_serialization_includes_directions(self):
        row = MagicMock(spec=PendingSeller)
        row.id = 5
        row.email = "seller@example.com"
        row.phone = "+79990001122"
        row.created_at = None
        row.last_name = "Иванов"
        row.first_name = "Иван"
        row.patronymic = None
        row.name_organization = "ООО Тест"
        row.description_organization = None
        row.address_organization = "Адрес"
        row.wants_seller = True
        row.wants_autoservice = True

        data = _serialize_pending_seller(row)

        self.assertEqual(data["id"], 5)
        self.assertTrue(data["wants_seller"])
        self.assertTrue(data["wants_autoservice"])


class ApplicationRequestedFlagsTests(unittest.TestCase):
    def test_legacy_application_defaults_to_autoservice(self):
        row = MagicMock(spec=AutoserviceTariffApplication)
        row.requested_seller = None
        row.requested_autoservice = None

        self.assertEqual(_requested_flags(row), (False, True))
        self.assertEqual(_application_requested_flags(row), (False, True))

    def test_explicit_flags(self):
        row = MagicMock(spec=AutoserviceTariffApplication)
        row.requested_seller = True
        row.requested_autoservice = False

        self.assertEqual(_requested_flags(row), (True, False))
        self.assertEqual(_application_requested_flags(row), (True, False))

    def test_both_requested(self):
        row = MagicMock(spec=AutoserviceTariffApplication)
        row.requested_seller = True
        row.requested_autoservice = True

        self.assertEqual(_requested_flags(row), (True, True))


if __name__ == "__main__":
    unittest.main()
