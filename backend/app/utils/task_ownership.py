from __future__ import annotations

import logging
from typing import Optional

from app.celery_app import celery_app
from app.utils.redis_sync import get_redis_sync

logger = logging.getLogger(__name__)

OWNER_KEY_PREFIX = "task_owner:"
DEFAULT_TTL_SECONDS = 3600


def _ttl_seconds() -> int:
    expires = celery_app.conf.result_expires
    return int(expires) if isinstance(expires, (int, float)) and expires > 0 else DEFAULT_TTL_SECONDS


def remember_task_owner(task_id: str, user_id: int) -> None:
    """Кто поставил задачу: AsyncResult про права ничего не знает."""
    try:
        get_redis_sync().setex(f"{OWNER_KEY_PREFIX}{task_id}", _ttl_seconds(), str(user_id))
    except Exception as exc:
        logger.warning("Failed to store owner of task %s: %s", task_id, exc)


def task_owner_user_id(task_id: str) -> Optional[int]:
    try:
        value = get_redis_sync().get(f"{OWNER_KEY_PREFIX}{task_id}")
    except Exception as exc:
        logger.warning("Failed to read owner of task %s: %s", task_id, exc)
        return None
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        return None
