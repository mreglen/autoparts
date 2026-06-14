from __future__ import annotations

import logging
from dataclasses import dataclass

from fastapi import Request

from app.utils.redis_sync import get_redis_sync

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RateLimitRule:
    prefix: str
    max_requests: int
    window_seconds: int


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    retry_after: int = 0


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def check_rate_limit(*, key: str, max_requests: int, window_seconds: int) -> RateLimitResult:
    """
    Fixed-window counter в Redis. Fail-open при недоступности Redis.
    """
    if max_requests <= 0 or window_seconds <= 0:
        return RateLimitResult(allowed=True)

    redis_key = f"rl:{key}"
    try:
        client = get_redis_sync()
        pipe = client.pipeline()
        pipe.incr(redis_key)
        pipe.ttl(redis_key)
        count, ttl = pipe.execute()
        if int(ttl) < 0:
            client.expire(redis_key, window_seconds)
            ttl = window_seconds

        if int(count) > max_requests:
            return RateLimitResult(allowed=False, retry_after=max(int(ttl), 1))
        return RateLimitResult(allowed=True)
    except Exception as exc:
        logger.warning("Rate limit check failed for %s: %s", redis_key, exc)
        return RateLimitResult(allowed=True)


def resolve_rate_limit_rule(path: str, rules: tuple[RateLimitRule, ...]) -> RateLimitRule | None:
    for rule in rules:
        if path.startswith(rule.prefix):
            return rule
    return None


def enforce_rate_limit(request: Request, rule: RateLimitRule) -> RateLimitResult:
    ip = client_ip(request)
    bucket = f"{rule.prefix}:{ip}"
    return check_rate_limit(
        key=bucket,
        max_requests=rule.max_requests,
        window_seconds=rule.window_seconds,
    )


def retry_after_header(result: RateLimitResult) -> str:
    return str(max(result.retry_after, 1))
