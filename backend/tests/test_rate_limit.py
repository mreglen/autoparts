import unittest
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from starlette.testclient import TestClient

from app.utils.rate_limit import (
    RateLimitRule,
    RateLimitResult,
    check_rate_limit,
    resolve_rate_limit_rule,
)


class RateLimitRuleResolutionTests(unittest.TestCase):
    def test_auth_login_has_stricter_rule_than_api(self):
        rules = (
            RateLimitRule(prefix="/api/auth/login", max_requests=10, window_seconds=900),
            RateLimitRule(prefix="/api/", max_requests=300, window_seconds=60),
        )
        self.assertEqual(
            resolve_rate_limit_rule("/api/auth/login", rules).max_requests,
            10,
        )
        self.assertEqual(
            resolve_rate_limit_rule("/api/products/public/", rules).max_requests,
            300,
        )


class RateLimitRedisTests(unittest.TestCase):
    @patch("app.utils.rate_limit.get_redis_sync")
    def test_allows_under_limit(self, mock_get_redis):
        client = MagicMock()
        client.pipeline.return_value.execute.return_value = [5, 30]
        mock_get_redis.return_value = client

        result = check_rate_limit(key="test:1.2.3.4", max_requests=10, window_seconds=60)
        self.assertTrue(result.allowed)

    @patch("app.utils.rate_limit.get_redis_sync")
    def test_blocks_over_limit(self, mock_get_redis):
        client = MagicMock()
        client.pipeline.return_value.execute.return_value = [11, 25]
        mock_get_redis.return_value = client

        result = check_rate_limit(key="test:1.2.3.4", max_requests=10, window_seconds=60)
        self.assertFalse(result.allowed)
        self.assertEqual(result.retry_after, 25)

    @patch("app.utils.rate_limit.get_redis_sync")
    def test_fail_open_on_redis_error(self, mock_get_redis):
        mock_get_redis.side_effect = ConnectionError("redis down")

        result = check_rate_limit(key="test:1.2.3.4", max_requests=10, window_seconds=60)
        self.assertTrue(result.allowed)


class RateLimitMiddlewareTests(unittest.TestCase):
    @patch("app.middleware.rate_limit_middleware.enforce_rate_limit")
    @patch("app.middleware.rate_limit_middleware.settings")
    def test_returns_429_when_limited(self, mock_settings, mock_enforce):
        from app.middleware.rate_limit_middleware import RateLimitMiddleware

        mock_settings.RATE_LIMIT_ENABLED = True
        mock_enforce.return_value = RateLimitResult(allowed=False, retry_after=12)

        app = FastAPI()
        app.add_middleware(RateLimitMiddleware)

        @app.get("/api/test")
        def test_endpoint():
            return {"ok": True}

        with TestClient(app) as client:
            response = client.get("/api/test")

        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.headers.get("retry-after"), "12")


if __name__ == "__main__":
    unittest.main()
