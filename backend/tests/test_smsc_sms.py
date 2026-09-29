import sys
import types
import unittest
from decimal import Decimal
from unittest.mock import MagicMock, patch

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

import app.models  # noqa: F401

from fastapi import HTTPException

from app.services import smsc_client

MOD = "app.services.smsc_client"


def _db_with_creds():
    db = MagicMock()
    settings = MagicMock()
    settings.smsc_login = "user"
    settings.smsc_password = "pass"
    db.query.return_value.filter.return_value.first.return_value = settings
    return db


def _ok_response(payload):
    resp = MagicMock()
    resp.json.return_value = payload
    resp.raise_for_status = MagicMock()
    return resp


class NormalizePhoneTests(unittest.TestCase):
    def test_plus7(self):
        self.assertEqual(smsc_client.normalize_phone_for_sms("+7 (999) 123-45-67"), "79991234567")

    def test_starts_with_8(self):
        self.assertEqual(smsc_client.normalize_phone_for_sms("8 999 1234567"), "79991234567")

    def test_ten_digits(self):
        self.assertEqual(smsc_client.normalize_phone_for_sms("9991234567"), "79991234567")

    def test_invalid(self):
        self.assertIsNone(smsc_client.normalize_phone_for_sms("123"))
        self.assertIsNone(smsc_client.normalize_phone_for_sms(None))


class SendSmscSmsTests(unittest.TestCase):
    def _send(self, phone="+7 999 123-45-67", text="Тест"):
        return smsc_client.send_smsc_sms(
            self.db, phone, text, organization_id="ORG1", user_id=1
        )

    def setUp(self):
        self.db = _db_with_creds()

    def test_success_logs_cost(self):
        with patch(f"{MOD}.requests.post", return_value=_ok_response({"id": 42, "cnt": 1, "cost": "6.45"})) as post:
            log = self._send()
        self.assertEqual(log.status, "sent")
        self.assertEqual(log.cost, Decimal("6.45"))
        self.assertEqual(log.provider_message_id, "42")
        self.assertEqual(log.phone, "79991234567")
        _, kwargs = post.call_args
        self.assertEqual(kwargs["data"]["cost"], 3)
        self.assertEqual(kwargs["data"]["phones"], "79991234567")

    def test_smsc_error_logged(self):
        with patch(f"{MOD}.requests.post", return_value=_ok_response({"error": "Недостаточно средств", "error_code": 3})):
            log = self._send()
        self.assertEqual(log.status, "error")
        self.assertIn("Недостаточно средств", log.error_message)

    def test_network_error_logged(self):
        with patch(f"{MOD}.requests.post", side_effect=Exception("timeout")):
            log = self._send()
        self.assertEqual(log.status, "error")
        self.assertIn("timeout", log.error_message)

    def test_invalid_phone_raises_400(self):
        with self.assertRaises(HTTPException) as ctx:
            self._send(phone="123")
        self.assertEqual(ctx.exception.status_code, 400)
        self.db.add.assert_called_once()

    def test_no_credentials_raises_503(self):
        settings = MagicMock()
        settings.smsc_login = ""
        settings.smsc_password = None
        self.db.query.return_value.filter.return_value.first.return_value = settings
        with patch(f"{MOD}.requests.post") as post:
            with self.assertRaises(HTTPException) as ctx:
                self._send()
        self.assertEqual(ctx.exception.status_code, 503)
        post.assert_not_called()


if __name__ == "__main__":
    unittest.main()
