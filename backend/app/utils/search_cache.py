import hashlib
import json
import logging
from typing import Any, Optional

from redis.asyncio import Redis

from app.core.config import settings

logger = logging.getLogger(__name__)

_redis_client: Optional[Redis] = None


def _get_redis() -> Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = Redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
    return _redis_client


def build_cache_key(namespace: str, query: str, **kwargs: Any) -> str:
    normalized_query = (query or "").strip().lower()
    extra = "|".join(f"{k}={kwargs[k]}" for k in sorted(kwargs))
    raw_key = f"{namespace}|q={normalized_query}|{extra}"
    digest = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
    return f"search:{namespace}:{digest}"


async def get_cached_json(key: str) -> Optional[dict]:
    try:
        payload = await _get_redis().get(key)
        if not payload:
            return None
        return json.loads(payload)
    except Exception as exc:  # fail-open
        logger.warning("Redis get failed for key %s: %s", key, exc)
        return None


async def set_cached_json(key: str, value: dict, ttl_seconds: int) -> None:
    try:
        payload = json.dumps(value, ensure_ascii=False, default=str)
        await _get_redis().setex(key, ttl_seconds, payload)
    except Exception as exc:  # fail-open
        logger.warning("Redis set failed for key %s: %s", key, exc)
