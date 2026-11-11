import sys
import types
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.datastructures import Headers

from app.core.auth import cleanup_old_user_sessions, get_current_user, resolve_client_kind
from app.db.database import Base
from app.models.user_session import UserSession
from app.routers.auth import enforce_login_rate_limit
from app.utils.rate_limit import rate_limit_bucket, resolve_rate_limit_rule


def _request(headers: dict, path: str = "/api/autoservice/repair-orders"):
    return SimpleNamespace(headers=Headers(headers), url=SimpleNamespace(path=path))


class RateLimitIdentityBucketTests(unittest.TestCase):
    def test_bearer_requests_get_own_bucket(self):
        first = _request({"authorization": "Bearer token-one", "x-forwarded-for": "203.0.113.7"})
        second = _request({"authorization": "Bearer token-two", "x-forwarded-for": "203.0.113.7"})
        self.assertNotEqual(rate_limit_bucket(first), rate_limit_bucket(second))
        self.assertTrue(rate_limit_bucket(first).startswith("tok:"))
        self.assertNotIn("203.0.113.7", rate_limit_bucket(first))

    def test_anonymous_request_buckets_by_ip(self):
        self.assertEqual(
            rate_limit_bucket(_request({"x-forwarded-for": "203.0.113.7, 10.0.0.1"})),
            "203.0.113.7",
        )

    def test_public_path_keeps_ip_bucket_even_with_token(self):
        request = _request(
            {"authorization": "Bearer token-one", "x-forwarded-for": "203.0.113.7"},
            path="/api/public/new-part-meta",
        )
        self.assertEqual(rate_limit_bucket(request), "203.0.113.7")

    def test_login_ip_rule_no_longer_blocks_an_office(self):
        from app.middleware.rate_limit_middleware import DEFAULT_RATE_LIMIT_RULES

        rule = resolve_rate_limit_rule("/api/auth/login", DEFAULT_RATE_LIMIT_RULES)
        self.assertGreaterEqual(rule.max_requests, 100)


class LoginRateLimitTests(unittest.TestCase):
    def test_keys_by_account_not_only_ip(self):
        request = _request({"x-forwarded-for": "203.0.113.7"}, path="/api/auth/login")
        with patch("app.routers.auth.check_rate_limit") as mock_check:
            mock_check.return_value = MagicMock(allowed=True)
            for index in range(6):
                enforce_login_rate_limit(request, f"employee{index}@example.com")
            key = mock_check.call_args.kwargs["key"]

        self.assertEqual(mock_check.call_count, 6)
        self.assertEqual(mock_check.call_args.kwargs["max_requests"], 40)
        self.assertTrue(key.startswith("auth-login:"))
        self.assertTrue(key.endswith(":203.0.113.7"))

        with patch("app.routers.auth.check_rate_limit") as mock_check:
            mock_check.return_value = MagicMock(allowed=True)
            enforce_login_rate_limit(request, "A@Example.com ")
            first_key = mock_check.call_args.kwargs["key"]
            enforce_login_rate_limit(request, "a@example.com")
            second_key = mock_check.call_args.kwargs["key"]
        self.assertEqual(first_key, second_key)

    def test_raises_429_with_retry_after(self):
        request = _request({"x-forwarded-for": "203.0.113.7"}, path="/api/auth/login")
        with patch("app.routers.auth.check_rate_limit") as mock_check:
            mock_check.return_value = MagicMock(allowed=False, retry_after=120)
            with self.assertRaises(HTTPException) as ctx:
                enforce_login_rate_limit(request, "boss@example.com")

        self.assertEqual(ctx.exception.status_code, 429)
        self.assertEqual(ctx.exception.headers.get("Retry-After"), "120")
        self.assertEqual(
            ctx.exception.detail,
            "Слишком много попыток входа. Подождите немного и попробуйте снова.",
        )


class ClientKindTests(unittest.TestCase):
    def test_platform_header_recognised_case_insensitively(self):
        self.assertEqual(resolve_client_kind(_request({"x-app-platform": "iOS"})), "ios")
        self.assertEqual(resolve_client_kind(_request({"X-App-Platform": "Android"})), "android")

    def test_web_and_unknown_platforms_stay_none(self):
        self.assertIsNone(resolve_client_kind(_request({})))
        self.assertIsNone(resolve_client_kind(_request({"x-app-platform": "windows"})))
        self.assertIsNone(resolve_client_kind(None))


class SessionEvictionOrderTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine, tables=[UserSession.__table__])
        self.db = sessionmaker(bind=self.engine)()
        self.started = datetime(2026, 11, 1, 9, 0, 0)

    def tearDown(self):
        self.db.close()

    def _add(self, kind, minutes_ago):
        session = UserSession(
            user_id=7,
            session_token=f"token-{kind}-{minutes_ago}",
            client_kind=kind,
            ip_address="203.0.113.7",
            is_active=True,
            created_at=self.started - timedelta(minutes=minutes_ago),
        )
        self.db.add(session)
        self.db.commit()
        return session

    def _survivors(self):
        return {
            s.client_kind or "web"
            for s in self.db.query(UserSession).filter(UserSession.user_id == 7).all()
        }

    def test_five_web_tabs_do_not_evict_oldest_mobile_session(self):
        mobile = self._add("ios", 600)
        for minutes_ago in (500, 400, 300, 200, 100):
            self._add(None, minutes_ago)

        cleanup_old_user_sessions(self.db, 7, "203.0.113.7")

        self.assertIsNotNone(
            self.db.get(UserSession, mobile.id),
            "самая старая сессия — телефон: вытеснять нужно веб-вкладку",
        )
        self.assertEqual(self.db.query(UserSession).count(), 5)

    def test_cap_still_applies_to_mobile_sessions(self):
        for index, kind in enumerate(("ios", "android", "ios", "android", "ios", "android")):
            self._add(kind, 600 - index)

        cleanup_old_user_sessions(self.db, 7, "203.0.113.7")

        self.assertEqual(self.db.query(UserSession).count(), 5)

    def test_other_ips_untouched(self):
        self.db.add(
            UserSession(
                user_id=7,
                session_token="other-ip",
                client_kind="ios",
                ip_address="198.51.100.4",
                created_at=self.started - timedelta(days=9),
            )
        )
        for minutes_ago in (900, 800, 700, 600, 500, 400):
            self._add(None, minutes_ago)

        cleanup_old_user_sessions(self.db, 7, "203.0.113.7")

        self.assertEqual(
            self.db.query(UserSession).filter(UserSession.ip_address == "198.51.100.4").count(),
            1,
        )


class MobileMetaContractTests(unittest.TestCase):
    def setUp(self):
        from fastapi import FastAPI
        from starlette.testclient import TestClient

        from app.core.auth import get_current_user
        from app.db.database import get_db
        from app.routers.mobile import router as mobile_router

        app = FastAPI()
        app.include_router(mobile_router, prefix="/api")
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1)
        app.dependency_overrides[get_db] = lambda: None
        self.client = TestClient(app)

    def _get(self, **row_values):
        from unittest import mock

        row = SimpleNamespace(
            **{
                "mobile_min_app_version": None,
                "mobile_apk_version": None,
                "mobile_apk_url": None,
                "mobile_apk_notes": None,
                **row_values,
            }
        )
        with mock.patch("app.routers.mobile.get_or_create_site_settings", return_value=row):
            response = self.client.get("/api/mobile/meta")
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_server_time_matches_utc_offset(self):
        body = self._get()

        self.assertEqual(body["timezone"], "Europe/Moscow")
        self.assertNotIn("Z", body["server_time"])
        self.assertNotIn("+", body["server_time"])
        wall_clock = datetime.strptime(body["server_time"], "%Y-%m-%dT%H:%M:%S")
        as_utc = wall_clock - timedelta(minutes=body["utc_offset_minutes"])
        now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
        self.assertLess(abs(as_utc - now_utc), timedelta(seconds=30))

    def test_apk_fields_absent_until_configured(self):
        body = self._get()

        self.assertIsNone(body["latest_apk"])
        self.assertIsNone(body["min_supported_app_version"])
        self.assertFalse(body["public_base_url"].endswith("/"))

    def test_apk_and_min_version_pass_through(self):
        body = self._get(
            mobile_min_app_version="1.0.0",
            mobile_apk_version="1.4.2",
            mobile_apk_url="https://svoygarage.ru/apk/app-1.4.2.apk",
            mobile_apk_notes="Планировщик и склад",
        )

        self.assertEqual(body["min_supported_app_version"], "1.0.0")
        self.assertEqual(
            body["latest_apk"],
            {
                "version": "1.4.2",
                "url": "https://svoygarage.ru/apk/app-1.4.2.apk",
                "notes": "Планировщик и склад",
            },
        )

    def test_blank_apk_fields_do_not_make_a_fake_release(self):
        body = self._get(mobile_apk_version="  ", mobile_apk_url="", mobile_apk_notes="  x  ")

        self.assertIsNone(body["latest_apk"])


class TaskStatusAccessTests(unittest.TestCase):
    TASK_ID = "3f2a1b0c-4d5e-4f60-8a7b-1c2d3e4f5061"

    def setUp(self):
        from fastapi import FastAPI
        from starlette.testclient import TestClient

        from app.core.auth import get_current_user
        from app.routers.tasks import router as tasks_router

        self.app = FastAPI()
        self.app.include_router(tasks_router, prefix="/api")
        self._client = TestClient

    def _get(self, as_user_id, owner_user_id, async_result=None):
        from unittest import mock

        self.app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=as_user_id)
        with mock.patch(
            "app.routers.tasks.task_owner_user_id", return_value=owner_user_id
        ), mock.patch("app.routers.tasks.AsyncResult", return_value=async_result or MagicMock()):
            return self._client(self.app).get(f"/api/tasks/{self.TASK_ID}")

    def test_foreign_task_is_forbidden(self):
        response = self._get(as_user_id=42, owner_user_id=7)
        self.assertEqual(response.status_code, 403)

    def test_task_without_owner_is_404(self):
        response = self._get(as_user_id=42, owner_user_id=None)
        self.assertEqual(response.status_code, 404)
        self.assertIn("detail", response.json())

    def test_malformed_task_id_never_reaches_redis(self):
        from unittest import mock

        self.app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=42)
        with mock.patch("app.routers.tasks.task_owner_user_id") as mock_owner:
            response = self._client(self.app).get("/api/tasks/../secrets")
        self.assertIn(response.status_code, (404, 422))
        mock_owner.assert_not_called()

    def test_success_returns_result(self):
        result = MagicMock(state="SUCCESS", info=None, result={"path": "/pictures/ORG1/a.webp"})
        response = self._get(as_user_id=42, owner_user_id=42, async_result=result)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["state"], "SUCCESS")
        self.assertEqual(response.json()["result"]["path"], "/pictures/ORG1/a.webp")

    def test_failure_error_is_single_line_without_stack(self):
        boom = Exception("/srv/autoparts/app/tasks/video_tasks.py line 88\nTraceback (inner)")
        result = MagicMock(state="FAILURE", info=boom, result=boom)
        response = self._get(as_user_id=42, owner_user_id=42, async_result=result)
        body = response.json()

        self.assertEqual(body["state"], "FAILURE")
        self.assertNotIn("\n", body["error"])
        self.assertFalse(body["result"])

    def test_progress_reported_for_running_task(self):
        result = MagicMock(state="PROGRESS", info={"progress": 40}, result=None)
        response = self._get(as_user_id=42, owner_user_id=42, async_result=result)
        self.assertEqual(response.json()["progress"], 40)


class TaskOwnershipRedisTests(unittest.TestCase):
    def test_owner_written_with_result_ttl(self):
        from unittest import mock

        from app.utils.task_ownership import OWNER_KEY_PREFIX, remember_task_owner

        client = MagicMock()
        with mock.patch("app.utils.task_ownership.get_redis_sync", return_value=client), mock.patch(
            "app.utils.task_ownership._ttl_seconds", return_value=3600
        ):
            remember_task_owner("task-1", 42)
        client.setex.assert_called_once_with(f"{OWNER_KEY_PREFIX}task-1", 3600, "42")

    def test_redis_failure_does_not_break_upload(self):
        from unittest import mock

        from app.utils.task_ownership import remember_task_owner, task_owner_user_id

        client = MagicMock()
        client.setex.side_effect = ConnectionError("redis down")
        client.get.side_effect = ConnectionError("redis down")
        with mock.patch("app.utils.task_ownership.get_redis_sync", return_value=client):
            remember_task_owner("task-1", 42)
            self.assertIsNone(task_owner_user_id("task-1"))


if __name__ == "__main__":
    unittest.main()
