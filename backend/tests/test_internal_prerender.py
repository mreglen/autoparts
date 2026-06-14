import unittest

from fastapi import Request

from app.core.internal_access import require_internal_prerender
from app.core.config import settings


class InternalPrerenderTests(unittest.TestCase):
    def setUp(self):
        self._original_token = settings.PRERENDER_INTERNAL_TOKEN
        settings.PRERENDER_INTERNAL_TOKEN = "test-secret-token"

    def tearDown(self):
        settings.PRERENDER_INTERNAL_TOKEN = self._original_token

    def _request(self, token: str | None = None) -> Request:
        headers = []
        if token is not None:
            headers.append((b"x-internal-prerender-token", token.encode()))
        scope = {
            "type": "http",
            "method": "GET",
            "path": "/api/public/page-check",
            "headers": headers,
            "query_string": b"",
            "client": ("127.0.0.1", 12345),
            "server": ("test", 80),
            "scheme": "http",
            "root_path": "",
        }
        return Request(scope)

    def test_missing_token_raises_403(self):
        from fastapi import HTTPException

        with self.assertRaises(HTTPException) as ctx:
            require_internal_prerender(self._request())
        self.assertEqual(ctx.exception.status_code, 403)

    def test_wrong_token_raises_403(self):
        from fastapi import HTTPException

        with self.assertRaises(HTTPException) as ctx:
            require_internal_prerender(self._request("wrong"))
        self.assertEqual(ctx.exception.status_code, 403)

    def test_valid_token_passes(self):
        require_internal_prerender(self._request("test-secret-token"))

    def test_empty_config_skips_check(self):
        settings.PRERENDER_INTERNAL_TOKEN = ""
        require_internal_prerender(self._request())


if __name__ == "__main__":
    unittest.main()
