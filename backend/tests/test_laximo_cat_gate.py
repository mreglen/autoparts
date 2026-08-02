import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock

from app.models.site_laximo_cat_integration import SiteLaximoCatIntegration
from app.services.laximo.gate import (
    INTERNAL_DISABLED,
    INTERNAL_NOT_CONFIGURED,
    INTERNAL_NOT_FOUND,
    INTERNAL_NOT_VERIFIED,
    INTERNAL_QUOTA_EXHAUSTED,
    INTERNAL_READY,
    PUBLIC_NOT_FOUND_MESSAGE,
    PUBLIC_TEMPORARILY_UNAVAILABLE,
    PUBLIC_UNAVAILABLE_MESSAGE,
    assert_public_message_safe,
    get_internal_status,
    laximo_cat_ready,
    map_to_public_reason,
    quota_exhausted,
    reset_verification_on_credential_change,
)
from app.utils.laximo_crypto import decrypt_laximo_secret, encrypt_laximo_secret


def _utc_today():
    return datetime.now(timezone.utc).date()


class LaximoCryptoTests(unittest.TestCase):
    def test_encrypt_decrypt_roundtrip(self):
        plain = "laximo-secret-password"
        token = encrypt_laximo_secret(plain)
        self.assertNotEqual(token, plain)
        self.assertEqual(decrypt_laximo_secret(token), plain)


class LaximoGateTests(unittest.TestCase):
    def _row(self, **kwargs) -> SiteLaximoCatIntegration:
        today = _utc_today()
        row = SiteLaximoCatIntegration(
            id=1,
            base_url="https://ws.laximo.ru/restApi/v1",
            is_enabled=False,
            last_test_ok=False,
            daily_request_limit=100,
            requests_today=0,
            requests_day=today,
            doc_requests_today=0,
            doc_requests_day=today,
        )
        for key, value in kwargs.items():
            setattr(row, key, value)
        return row

    def test_not_configured(self):
        row = self._row()
        db = MagicMock()
        self.assertEqual(get_internal_status(db, row), INTERNAL_NOT_CONFIGURED)
        self.assertFalse(laximo_cat_ready(db, row))

    def test_ready(self):
        row = self._row(
            login_encrypted="x",
            password_encrypted="y",
            last_test_ok=True,
            is_enabled=True,
            requests_today=10,
            daily_request_limit=100,
        )
        db = MagicMock()
        self.assertEqual(get_internal_status(db, row), INTERNAL_READY)
        self.assertTrue(laximo_cat_ready(db, row))

    def test_quota_exhausted_blocks_ready(self):
        row = self._row(
            login_encrypted="x",
            password_encrypted="y",
            last_test_ok=True,
            is_enabled=True,
            requests_today=100,
            daily_request_limit=100,
        )
        db = MagicMock()
        self.assertTrue(quota_exhausted(row))
        self.assertEqual(get_internal_status(db, row), INTERNAL_QUOTA_EXHAUSTED)
        self.assertFalse(laximo_cat_ready(db, row))

    def test_not_verified_and_disabled(self):
        db = MagicMock()
        row = self._row(login_encrypted="x", password_encrypted="y", last_test_ok=False)
        self.assertEqual(get_internal_status(db, row), INTERNAL_NOT_VERIFIED)
        row.last_test_ok = True
        row.is_enabled = False
        self.assertEqual(get_internal_status(db, row), INTERNAL_DISABLED)

    def test_map_to_public_reason_hides_quota(self):
        self.assertEqual(map_to_public_reason(INTERNAL_QUOTA_EXHAUSTED), PUBLIC_TEMPORARILY_UNAVAILABLE)
        self.assertEqual(map_to_public_reason(INTERNAL_NOT_CONFIGURED), PUBLIC_TEMPORARILY_UNAVAILABLE)
        self.assertEqual(map_to_public_reason(INTERNAL_NOT_FOUND), "not_found")

    def test_public_messages_safe(self):
        self.assertTrue(assert_public_message_safe(PUBLIC_UNAVAILABLE_MESSAGE))
        self.assertTrue(assert_public_message_safe(PUBLIC_NOT_FOUND_MESSAGE))
        self.assertFalse(assert_public_message_safe("квота API Laximo закончилась"))

    def test_credential_change_resets_verification(self):
        row = self._row(
            login_encrypted="x",
            password_encrypted="y",
            last_test_ok=True,
            is_enabled=True,
            last_test_error="old",
            last_test_catalogs_count=12,
            last_tested_at=datetime.now(timezone.utc),
        )
        reset_verification_on_credential_change(row)
        self.assertFalse(row.last_test_ok)
        self.assertFalse(row.is_enabled)
        self.assertIsNone(row.last_test_error)
        self.assertIsNone(row.last_test_catalogs_count)
        self.assertIsNone(row.last_tested_at)

    def test_unlimited_quota_when_limit_zero(self):
        row = self._row(
            login_encrypted="x",
            password_encrypted="y",
            last_test_ok=True,
            is_enabled=True,
            daily_request_limit=0,
            requests_today=9999,
        )
        self.assertFalse(quota_exhausted(row))
        self.assertTrue(laximo_cat_ready(MagicMock(), row))


if __name__ == "__main__":
    unittest.main()
