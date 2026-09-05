"""
Тонкая обёртка: периодическая проверка MarzVPN-ключей через общий Celery сайта.

Задача делегирует в пакет vpn-marzban-bot/bot (если он доступен по пути),
иначе no-op с логом. Основной воркер бота — отдельный systemd unit
marzban-vpn-bot-celery; эта задача нужна, если хотите один beat на Redis сайта.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

from app.celery_app import celery_app

logger = logging.getLogger(__name__)

_BOT_CANDIDATES = (
    Path("/opt/marzban-vpn-bot"),
    Path(__file__).resolve().parents[3] / "vpn-marzban-bot" / "bot",
)


def _ensure_bot_path() -> Path | None:
    for candidate in _BOT_CANDIDATES:
        if (candidate / "tasks.py").is_file():
            path = str(candidate)
            if path not in sys.path:
                sys.path.insert(0, path)
            return candidate
    return None


@celery_app.task(name="marzvpn.verify_keys_authenticity")
def verify_marzvpn_keys_authenticity() -> dict:
    bot_dir = _ensure_bot_path()
    if bot_dir is None:
        logger.warning("MarzVPN bot package not found; skip key verify")
        return {"skipped": True, "reason": "bot_package_missing"}

    from tasks import verify_keys_authenticity as _run  # type: ignore

    # Celery task object → вызываем underlying sync функцию
    if hasattr(_run, "run"):
        return _run.run()
    return _run()
