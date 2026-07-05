"""Redis leader election so APScheduler runs in only one Gunicorn worker."""
from __future__ import annotations

import logging
import os

from app.utils.redis_sync import get_redis_sync

logger = logging.getLogger(__name__)

LOCK_KEY = "scheduler:leader"
LOCK_TTL_SECONDS = 90

_RENEW_SCRIPT = """
if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('expire', KEYS[1], ARGV[2])
else
    return 0
end
"""


def _leader_value() -> str:
    return str(os.getpid())


def try_acquire_scheduler_lock() -> bool:
    try:
        acquired = bool(
            get_redis_sync().set(
                LOCK_KEY,
                _leader_value(),
                nx=True,
                ex=LOCK_TTL_SECONDS,
            )
        )
        if acquired:
            logger.info("Acquired scheduler leader lock (pid=%s)", os.getpid())
        return acquired
    except Exception as exc:
        logger.warning("Scheduler leader lock acquire failed: %s", exc)
        return False


def renew_scheduler_lock() -> bool:
    try:
        renewed = bool(
            get_redis_sync().eval(
                _RENEW_SCRIPT,
                1,
                LOCK_KEY,
                _leader_value(),
                str(LOCK_TTL_SECONDS),
            )
        )
        return renewed
    except Exception as exc:
        logger.warning("Scheduler leader lock renew failed: %s", exc)
        return False


def release_scheduler_lock() -> None:
    try:
        client = get_redis_sync()
        if client.get(LOCK_KEY) == _leader_value():
            client.delete(LOCK_KEY)
            logger.info("Released scheduler leader lock (pid=%s)", os.getpid())
    except Exception as exc:
        logger.warning("Scheduler leader lock release failed: %s", exc)
