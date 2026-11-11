from __future__ import annotations

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)


class AppVersionLoggingMiddleware(BaseHTTPMiddleware):
    """Пишет в лог версию и платформу мобильного клиента из заголовков запроса."""

    async def dispatch(self, request: Request, call_next) -> Response:
        app_version = request.headers.get("X-App-Version")
        if app_version and request.url.path.startswith("/api/"):
            logger.info(
                "Mobile request %s %s app_version=%s platform=%s",
                request.method,
                request.url.path,
                app_version,
                request.headers.get("X-App-Platform") or "unknown",
            )
        return await call_next(request)
