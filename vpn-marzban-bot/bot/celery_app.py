"""Celery-приложение для фоновых задач MarzVPN-бота."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from celery import Celery

from config import get_settings

settings = get_settings()

celery_app = Celery(
    "marzvpn_bot",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["tasks"],
)

_verify_every = max(60, settings.key_verify_interval_minutes * 60)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
    beat_schedule={
        "marzvpn-verify-keys": {
            "task": "marzvpn.verify_keys_authenticity",
            "schedule": float(_verify_every),
        },
    },
)
