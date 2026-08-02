import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from app.models.site_laximo_cat_integration import SiteLaximoCatIntegration
from app.services.laximo.doc_client import (
    LaximoDocError,
    _normalize_replacements,
    clear_find_oem_cache,
)
from app.services.laximo.gate import (
    INTERNAL_DISABLED,
    INTERNAL_NOT_CONFIGURED,
    INTERNAL_NOT_VERIFIED,
    INTERNAL_QUOTA_EXHAUSTED,
    INTERNAL_READY,
    PUBLIC_UNAVAILABLE_MESSAGE,
    assert_public_message_safe,
    doc_quota_exhausted,
    get_doc_internal_status,
    laximo_doc_ready,
    reset_doc_verification_on_credential_change,
)


def _utc_today():
    return datetime.now(timezone.utc).date()


class LaximoDocGateTests(unittest.TestCase):
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
            doc_base_url="https://ws.laximo.ru/restApi/v1",
            doc_is_enabled=False,
            doc_last_test_ok=False,
            doc_requests_today=0,
            doc_requests_day=today,
        )
        for key, value in kwargs.items():
            setattr(row, key, value)
        return row

    def test_doc_not_configured(self):
        row = self._row()
        db = MagicMock()
        self.assertEqual(get_doc_internal_status(db, row), INTERNAL_NOT_CONFIGURED)
        self.assertFalse(laximo_doc_ready(db, row))

    def test_doc_ready(self):
        row = self._row(
            doc_login_encrypted="x",
            doc_password_encrypted="y",
            doc_last_test_ok=True,
            doc_is_enabled=True,
            doc_requests_today=10,
            daily_request_limit=100,
        )
        db = MagicMock()
        self.assertEqual(get_doc_internal_status(db, row), INTERNAL_READY)
        self.assertTrue(laximo_doc_ready(db, row))

    def test_doc_quota_blocks_ready(self):
        row = self._row(
            doc_login_encrypted="x",
            doc_password_encrypted="y",
            doc_last_test_ok=True,
            doc_is_enabled=True,
            doc_requests_today=100,
            daily_request_limit=100,
        )
        db = MagicMock()
        self.assertTrue(doc_quota_exhausted(row))
        self.assertEqual(get_doc_internal_status(db, row), INTERNAL_QUOTA_EXHAUSTED)
        self.assertFalse(laximo_doc_ready(db, row))

    def test_doc_not_verified_and_disabled(self):
        row = self._row(
            doc_login_encrypted="x",
            doc_password_encrypted="y",
            doc_last_test_ok=False,
        )
        db = MagicMock()
        self.assertEqual(get_doc_internal_status(db, row), INTERNAL_NOT_VERIFIED)

        row.doc_last_test_ok = True
        row.doc_is_enabled = False
        self.assertEqual(get_doc_internal_status(db, row), INTERNAL_DISABLED)

    def test_reset_doc_verification(self):
        row = self._row(
            doc_login_encrypted="x",
            doc_password_encrypted="y",
            doc_last_test_ok=True,
            doc_is_enabled=True,
        )
        reset_doc_verification_on_credential_change(row)
        self.assertFalse(row.doc_last_test_ok)
        self.assertFalse(row.doc_is_enabled)

    def test_public_message_safe(self):
        self.assertTrue(assert_public_message_safe(PUBLIC_UNAVAILABLE_MESSAGE))
        self.assertFalse(assert_public_message_safe("Laximo quota exhausted"))


class FindOemNormalizeTests(unittest.TestCase):
    def test_normalize_replacements(self):
        payload = [
            {
                "oem": "0913128000",
                "manufacturer": "HYUNDAI/KIA",
                "replacements": [
                    {
                        "type": "Replacement",
                        "way": "Backward",
                        "rate": "4",
                        "detail": {
                            "manufacturer": "PATRON",
                            "oem": "P681B21",
                            "name": "КЛЮЧ",
                        },
                    },
                    {
                        "type": "Replacement",
                        "rate": "5",
                        "detail": {
                            "manufacturer": "PATRON",
                            "oem": "P681B21",
                            "name": "dup",
                        },
                    },
                ],
            }
        ]
        rows = _normalize_replacements(payload)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["brand"], "PATRON")
        self.assertEqual(rows[0]["oem"], "P681B21")
        self.assertEqual(rows[0]["rate"], 4)


class OemAnalogsSoftFailTests(unittest.TestCase):
    def setUp(self):
        clear_find_oem_cache()

    def test_doc_not_ready_skips_find_oem(self):
        from app.services.laximo.oem_availability import lookup_oem_availability

        with patch(
            "app.services.laximo.oem_availability.laximo_doc_ready",
            return_value=False,
        ) as ready_mock, patch(
            "app.services.laximo.oem_availability.find_oem"
        ) as find_mock, patch(
            "app.services.laximo.oem_availability._lookup_rossko",
            return_value={
                "available": True,
                "count": 1,
                "min_price": 100.0,
                "sample": {"brand": "X", "article": "OEM1"},
            },
        ), patch(
            "app.services.laximo.oem_availability._lookup_used",
            return_value={"available": True, "count": 2, "sample_product_id": 1},
        ):
            out = lookup_oem_availability(MagicMock(), ["OEM1"])

        ready_mock.assert_called()
        find_mock.assert_not_called()
        item = out["items"][0]
        self.assertTrue(item["rossko"]["available"])
        self.assertTrue(item["used"]["available"])
        self.assertFalse(item["analogs"]["available"])
        self.assertEqual(item["analogs"]["items"], [])

    def test_find_oem_replacements_become_analogs(self):
        from app.services.laximo.oem_availability import lookup_oem_availability

        replacements = [
            {"brand": "PATRON", "oem": "P681B21", "name": "Ключ", "rate": 4},
            {"brand": "FEB", "oem": "12345", "name": "Alt", "rate": 5},
        ]

        def rossko_side(oem):
            if oem == "P681B21":
                return {
                    "available": True,
                    "count": 3,
                    "min_price": 500.0,
                    "sample": {"brand": "PATRON", "article": "P681B21"},
                }
            return {"available": False, "count": 0, "min_price": None, "sample": None}

        with patch(
            "app.services.laximo.oem_availability.laximo_doc_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.oem_availability.find_oem",
            return_value=replacements,
        ) as find_mock, patch(
            "app.services.laximo.oem_availability._lookup_rossko",
            side_effect=rossko_side,
        ), patch(
            "app.services.laximo.oem_availability._lookup_used",
            return_value={"available": False, "count": 0, "sample_product_id": None},
        ):
            out = lookup_oem_availability(MagicMock(), ["0913128000"])

        find_mock.assert_called_once()
        kwargs = find_mock.call_args.kwargs
        self.assertTrue(kwargs.get("count_toward_quota"))
        analogs = out["items"][0]["analogs"]
        self.assertTrue(analogs["available"])
        self.assertEqual(analogs["count"], 2)
        self.assertEqual(analogs["items"][0]["oem"], "P681B21")
        self.assertTrue(analogs["items"][0]["rossko"]["available"])

    def test_doc_upstream_fail_keeps_rossko_used(self):
        from app.services.laximo.oem_availability import lookup_oem_availability

        with patch(
            "app.services.laximo.oem_availability.laximo_doc_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.oem_availability.find_oem",
            side_effect=LaximoDocError("HTTP 500"),
        ), patch(
            "app.services.laximo.oem_availability._lookup_rossko",
            return_value={
                "available": True,
                "count": 1,
                "min_price": 10.0,
                "sample": {"brand": "A", "article": "OEM1"},
            },
        ), patch(
            "app.services.laximo.oem_availability._lookup_used",
            return_value={"available": True, "count": 1, "sample_product_id": 9},
        ):
            out = lookup_oem_availability(MagicMock(), ["OEM1"])

        item = out["items"][0]
        self.assertTrue(out["ok"])
        self.assertTrue(item["rossko"]["available"])
        self.assertTrue(item["used"]["available"])
        self.assertFalse(item["analogs"]["available"])


class DocQuotaIncrementTests(unittest.TestCase):
    def test_request_doc_counts_quota_when_enabled(self):
        from app.services.laximo import doc_client

        clear_find_oem_cache()
        db = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"[]"
        mock_response.json.return_value = []

        with patch(
            "app.services.laximo.doc_client._resolve_doc_credentials",
            return_value=("u", "p", "https://ws.laximo.ru/restApi/v1"),
        ), patch(
            "app.services.laximo.doc_client.get_or_create_laximo_cat_integration",
            return_value=MagicMock(
                doc_login_encrypted="x",
                doc_password_encrypted="y",
            ),
        ), patch(
            "app.services.laximo.doc_client.doc_credentials_configured",
            return_value=True,
        ), patch(
            "app.services.laximo.doc_client.increment_laximo_doc_request_counter"
        ) as inc, patch(
            "httpx.Client"
        ) as client_cls:
            client = MagicMock()
            client.__enter__.return_value = client
            client.__exit__.return_value = False
            client.post.return_value = mock_response
            client_cls.return_value = client

            doc_client.find_oem(db, "0913128000", count_toward_quota=True, use_cache=False)

        inc.assert_called()


if __name__ == "__main__":
    unittest.main()
