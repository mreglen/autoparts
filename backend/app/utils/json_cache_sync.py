from __future__ import annotations

import json
import logging
from typing import Any, Optional

from app.utils.redis_sync import get_redis_sync

logger = logging.getLogger(__name__)


def get_cached_json_sync(key: str) -> Optional[Any]:
    try:
        payload = get_redis_sync().get(key)
        if not payload:
            return None
        return json.loads(payload)
    except Exception as exc:
        logger.warning("Redis get failed for key %s: %s", key, exc)
        return None


def set_cached_json_sync(key: str, value: Any, ttl_seconds: int) -> None:
    try:
        payload = json.dumps(value, ensure_ascii=False, default=str)
        get_redis_sync().setex(key, ttl_seconds, payload)
    except Exception as exc:
        logger.warning("Redis set failed for key %s: %s", key, exc)
