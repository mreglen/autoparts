"""Безопасная постановка Celery-задач из async-кода (не блокирует event loop)."""
from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)


def _dispatch(task: Any, *args, **kwargs):
    return task.delay(*args, **kwargs)


async def enqueue_celery_task(task: Any, *args, **kwargs) -> Any | None:
    """
    Вызывает task.delay() в отдельном потоке.
    При недоступности Redis/Celery не блокирует обработку HTTP-запросов.
    """
    try:
        return await asyncio.to_thread(_dispatch, task, *args, **kwargs)
    except Exception as exc:
        logger.warning("Celery enqueue failed for %s: %s", getattr(task, "name", task), exc)
        return None
