from __future__ import annotations

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings
from app.utils.rate_limit import (
    RateLimitRule,
    enforce_rate_limit,
    resolve_rate_limit_rule,
    retry_after_header,
)

logger = logging.getLogger(__name__)

# Порядок важен: более специфичные префиксы первыми.
DEFAULT_RATE_LIMIT_RULES: tuple[RateLimitRule, ...] = (
    RateLimitRule(prefix="/api/auth/login", max_requests=10, window_seconds=900),
    RateLimitRule(prefix="/api/auth/register", max_requests=5, window_seconds=3600),
    RateLimitRule(prefix="/api/auth/password", max_requests=5, window_seconds=3600),
    RateLimitRule(prefix="/api/auth/seller/register", max_requests=5, window_seconds=3600),
    RateLimitRule(prefix="/api/public/autoservice/inspection-bookings", max_requests=10, window_seconds=900),
    RateLimitRule(prefix="/api/public/analytics/events", max_requests=180, window_seconds=60),
    RateLimitRule(prefix="/api/public/part-reference-fitment", max_requests=90, window_seconds=60),
    RateLimitRule(prefix="/api/public/part-meta", max_requests=90, window_seconds=60),
    RateLimitRule(prefix="/api/public/new-part-meta", max_requests=90, window_seconds=60),
    RateLimitRule(prefix="/api/products/public/find-used-match", max_requests=90, window_seconds=60),
    RateLimitRule(prefix="/api/products/public/", max_requests=120, window_seconds=60),
    RateLimitRule(prefix="/api/catalog/", max_requests=180, window_seconds=60),
    RateLimitRule(prefix="/api/", max_requests=600, window_seconds=60),
)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, rules: tuple[RateLimitRule, ...] | None = None):
        super().__init__(app)
        self.rules = rules or DEFAULT_RATE_LIMIT_RULES

    async def dispatch(self, request: Request, call_next) -> Response:
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)

        path = request.url.path
        if not path.startswith("/api/"):
            return await call_next(request)

        rule = resolve_rate_limit_rule(path, self.rules)
        if rule is None:
            return await call_next(request)

        result = enforce_rate_limit(request, rule)
        if not result.allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests"},
                headers={"Retry-After": retry_after_header(result)},
            )

        return await call_next(request)
