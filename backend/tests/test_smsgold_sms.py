import sys
import types
import unittest
from decimal import Decimal
from unittest.mock import MagicMock, patch

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

import app.models  # noqa: F401

from fastapi import HTTPException

from app.services import smsgold_client

MOD = "app.services.smsgold_client"

BALANCE_XML = (
    '<?xml version="1.0" encoding="UTF-8"?><output>'
    '<xml_result action="http_post_balance" err="">'
    '<result currency="RUB"><account>100.00</account></result>'
    "</xml_result></output>"
)
SEND_OK_XML = (
    '<?xml version="1.0" encoding="UTF-8"?><output>'
    '<xml_result action="http_post_send" err="">'
    '<result sms_group_id="12-34"><sms sms_id="998877" err="" '
    'number="79991234567" parts="1"><![CDATA[Тест]]></sms></result>'
    "</xml_result></output>"
)


def _db_with_creds():
    db = MagicMock()
    settings = MagicMock()
    settings.smsgold_user = "10101"
    settings.smsgold_password = "pass"
    settings.smsgold_sender = ""
    db.query.return_value.filter.return_value.first.return_value = settings
    return db


def _ok_response(body):
    resp = MagicMock()
    resp.text = body
    resp.raise_for_status = MagicMock()
    return resp


class NormalizePhoneTests(unittest.TestCase):
    def test_plus7(self):
        self.assertEqual(smsgold_client.normalize_phone_for_sms("+7 (999) 123-45-67"), "79991234567")

    def test_starts_with_8(self):
        self.assertEqual(smsgold_client.normalize_phone_for_sms("8 999 1234567"), "79991234567")

    def test_ten_digits(self):
        self.assertEqual(smsgold_client.normalize_phone_for_sms("9991234567"), "79991234567")

    def test_invalid(self):
        self.assertIsNone(smsgold_client.normalize_phone_for_sms("123"))
        self.assertIsNone(smsgold_client.normalize_phone_for_sms(None))


class SendSmsgoldSmsTests(unittest.TestCase):
    def _send(self, phone="+7 999 123-45-67", text="Тест"):
        return smsgold_client.send_smsgold_sms(
            self.db, phone, text, organization_id="ORG1", user_id=1
        )

    def setUp(self):
        self.db = _db_with_creds()

    def test_success_logs_message_id(self):
        responses = [
            _ok_response(BALANCE_XML),
            _ok_response(SEND_OK_XML),
            _ok_response(BALANCE_XML),
        ]
        with patch(f"{MOD}.requests.post", side_effect=responses) as post:
            log = self._send()
        self.assertEqual(log.status, "sent")
        self.assertEqual(log.provider_message_id, "998877")
        self.assertEqual(log.phone, "79991234567")
        send_call = post.call_args_list[1]
        self.assertEqual(send_call.kwargs["data"]["action"], "send")
        self.assertEqual(send_call.kwargs["data"]["number"], "79991234567")

    def test_smsgold_error_logged(self):
        err_xml = (
            '<?xml version="1.0"?><output><xml_result action="http_post_send" '
            'err="1"><result><sms err="2" number="79991234567"/></result></xml_result></output>'
        )
        with patch(f"{MOD}.requests.post", return_value=_ok_response(err_xml)):
            log = self._send()
        self.assertEqual(log.status, "error")
        self.assertIn("SMS Gold", log.error_message)

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
        settings.smsgold_user = ""
        settings.smsgold_password = None
        settings.smsgold_sender = None
        self.db.query.return_value.filter.return_value.first.return_value = settings
        with patch(f"{MOD}.requests.post") as post:
            with self.assertRaises(HTTPException) as ctx:
                self._send()
        self.assertEqual(ctx.exception.status_code, 503)
        post.assert_not_called()

    def test_sender_passed_when_set(self):
        settings = MagicMock()
        settings.smsgold_user = "10101"
        settings.smsgold_password = "pass"
        settings.smsgold_sender = "SvoiGarazh"
        self.db.query.return_value.filter.return_value.first.return_value = settings
        with patch(f"{MOD}.requests.post", return_value=_ok_response(SEND_OK_XML)):
            log = self._send()
        self.assertEqual(log.status, "sent")


if __name__ == "__main__":
    unittest.main()
