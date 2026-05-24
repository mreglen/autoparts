import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.models.organization_avito_integration import OrganizationAvitoIntegration
from app.services.avito_pro_status_service import (
    PRO_INACTIVE_MESSAGE,
    _classify_http,
    check_and_persist_avito_pro_status,
    ensure_avito_pro_active,
    is_avito_pro_active,
)


class AvitoProStatusClassificationTests(unittest.TestCase):
    def test_200_is_available(self):
        result = _classify_http(200)
        self.assertTrue(result.available)

    def test_403_is_pro_inactive(self):
        result = _classify_http(403, "access denied")
        self.assertFalse(result.available)
        self.assertEqual(result.reason, PRO_INACTIVE_MESSAGE)

    def test_401_is_credentials_error(self):
        result = _classify_http(401)
        self.assertFalse(result.available)
        self.assertTrue(result.credentials_error)

    def test_502_is_transient(self):
        result = _classify_http(502)
        self.assertTrue(result.transient)


class AvitoProStatusPersistenceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        self._create_tables()
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.db = self.Session()
        self.org_id = "org1"
        self.row = OrganizationAvitoIntegration(
            organization_id=self.org_id,
            avito_user_id=123,
            client_id="client",
            client_secret_encrypted="enc",
            enabled=True,
            pro_active=True,
        )
        self.db.add(self.row)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _create_tables(self):
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    CREATE TABLE organization_avito_integration (
                        organization_id VARCHAR(10) PRIMARY KEY,
                        avito_user_id BIGINT NOT NULL,
                        client_id VARCHAR(255) NOT NULL,
                        client_secret_encrypted TEXT NOT NULL,
                        enabled BOOLEAN NOT NULL DEFAULT 1,
                        pro_active BOOLEAN NOT NULL DEFAULT 1,
                        pro_status_message TEXT,
                        pro_status_checked_at DATETIME,
                        pro_features_json TEXT,
                        updated_at DATETIME
                    )
                    """
                )
            )

    def test_is_avito_pro_active_false_when_disabled(self):
        self.row.pro_active = False
        self.db.commit()
        self.assertFalse(is_avito_pro_active(self.db, self.org_id))

    def test_ensure_avito_pro_active_raises_403(self):
        self.row.pro_active = False
        self.row.pro_status_message = PRO_INACTIVE_MESSAGE
        self.db.commit()
        with self.assertRaises(HTTPException) as ctx:
            ensure_avito_pro_active(self.db, self.org_id)
        self.assertEqual(ctx.exception.status_code, 403)

    @patch("app.services.avito_pro_status_service.decrypt_secret", return_value="secret")
    @patch("app.services.avito_pro_status_service.avito_api_svc.fetch_access_token", new_callable=AsyncMock)
    @patch("app.services.avito_pro_status_service._probe_messenger", new_callable=AsyncMock)
    @patch("app.services.avito_pro_status_service._probe_orders", new_callable=AsyncMock)
    @patch("app.services.avito_pro_status_service._probe_autoload", new_callable=AsyncMock)
    def test_all_probes_ok_sets_pro_active_true(self, autoload, orders, messenger, token_mock, _decrypt):
        token_mock.return_value = "token"
        autoload.return_value = _classify_http(200)
        orders.return_value = _classify_http(200)
        messenger.return_value = _classify_http(200)

        result = asyncio_run(
            check_and_persist_avito_pro_status(self.db, self.org_id, force=True)
        )
        self.db.refresh(self.row)
        self.assertTrue(result.pro_active)
        self.assertTrue(self.row.pro_active)

    @patch("app.services.avito_pro_status_service.decrypt_secret", return_value="secret")
    @patch("app.services.avito_pro_status_service.avito_api_svc.fetch_access_token", new_callable=AsyncMock)
    @patch("app.services.avito_pro_status_service._probe_messenger", new_callable=AsyncMock)
    @patch("app.services.avito_pro_status_service._probe_orders", new_callable=AsyncMock)
    @patch("app.services.avito_pro_status_service._probe_autoload", new_callable=AsyncMock)
    def test_orders_403_sets_pro_active_false(self, autoload, orders, messenger, token_mock, _decrypt):
        token_mock.return_value = "token"
        autoload.return_value = _classify_http(200)
        orders.return_value = _classify_http(403)
        messenger.return_value = _classify_http(200)

        result = asyncio_run(
            check_and_persist_avito_pro_status(self.db, self.org_id, force=True)
        )
        self.db.refresh(self.row)
        self.assertFalse(result.pro_active)
        self.assertFalse(self.row.pro_active)
        self.assertEqual(result.pro_status_message, PRO_INACTIVE_MESSAGE)

    @patch("app.services.avito_pro_status_service.decrypt_secret", return_value="secret")
    @patch("app.services.avito_pro_status_service.avito_api_svc.fetch_access_token", new_callable=AsyncMock)
    @patch("app.services.avito_pro_status_service._probe_messenger", new_callable=AsyncMock)
    @patch("app.services.avito_pro_status_service._probe_orders", new_callable=AsyncMock)
    @patch("app.services.avito_pro_status_service._probe_autoload", new_callable=AsyncMock)
    def test_transient_error_keeps_previous_status(self, autoload, orders, messenger, token_mock, _decrypt):
        self.row.pro_active = True
        self.row.pro_status_checked_at = datetime.now(tz=timezone.utc) - timedelta(hours=1)
        self.db.commit()

        token_mock.return_value = "token"
        autoload.return_value = _classify_http(200)
        orders.return_value = _classify_http(502)
        messenger.return_value = _classify_http(200)

        result = asyncio_run(
            check_and_persist_avito_pro_status(self.db, self.org_id, force=True)
        )
        self.db.refresh(self.row)
        self.assertTrue(result.stale)
        self.assertTrue(self.row.pro_active)

    def test_delivery_check_shape_from_status(self):
        self.row.pro_active = False
        self.row.pro_status_message = PRO_INACTIVE_MESSAGE
        self.db.commit()
        delivery_enabled = is_avito_pro_active(self.db, self.org_id)
        payload = {
            "delivery_enabled": delivery_enabled,
            "message": self.row.pro_status_message if not delivery_enabled else None,
        }
        self.assertFalse(payload["delivery_enabled"])
        self.assertEqual(payload["message"], PRO_INACTIVE_MESSAGE)


def asyncio_run(coro):
    import asyncio

    return asyncio.run(coro)


if __name__ == "__main__":
    unittest.main()
