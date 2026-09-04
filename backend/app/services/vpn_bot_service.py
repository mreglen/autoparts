"""Apply Marzban VPN Telegram bot token to host .env and systemd unit."""

from __future__ import annotations

import logging
import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

APPLY_BIN = Path("/usr/local/bin/marzban-vpn-bot-apply")
_TOKEN_RE = re.compile(r"^\d{6,}:[A-Za-z0-9_-]{20,}$")


def normalize_bot_token(raw: str) -> str:
    token = (raw or "").strip()
    if not token:
        raise ValueError("Токен бота пуст")
    if not _TOKEN_RE.match(token):
        raise ValueError(
            "Неверный формат токена Telegram (ожидается вид 123456:AA... от @BotFather)"
        )
    return token


def get_plain_bot_token(row) -> str | None:
    from app.utils.vpn_bot_crypto import decrypt_vpn_bot_secret

    enc = getattr(row, "bot_token_encrypted", None)
    if not enc:
        return None
    try:
        return decrypt_vpn_bot_secret(enc)
    except Exception:
        logger.exception("Failed to decrypt VPN bot token")
        return None


def apply_vpn_bot_runtime(*, token: str | None, enabled: bool) -> dict[str, Any]:
    """
    Sync token into /opt/marzban-vpn-bot/.env and enable/disable systemd service.
    Uses sudo helper on Linux production; on Windows / without helper — DB-only.
    """
    if os.name == "nt":
        return {
            "applied": False,
            "service_active": False,
            "message": "На Windows runtime не применяется — токен сохранён в БД",
        }

    apply_bin = Path(settings.VPN_BOT_APPLY_BIN or str(APPLY_BIN))
    if not apply_bin.is_file():
        return {
            "applied": False,
            "service_active": False,
            "message": (
                f"Хелпер {apply_bin} не установлен. "
                "Токен сохранён в БД; установите скрипт apply на сервере."
            ),
        }

    action = "enable" if enabled and token else "disable"
    tmp_path: Path | None = None
    try:
        if token:
            fd, name = tempfile.mkstemp(prefix="vpn-bot-token-", text=True)
            tmp_path = Path(name)
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                fh.write(token)
            os.chmod(tmp_path, 0o600)

        cmd = ["sudo", "-n", str(apply_bin), action]
        if tmp_path is not None:
            cmd.append(str(tmp_path))

        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
        stdout = (proc.stdout or "").strip()
        stderr = (proc.stderr or "").strip()
        if proc.returncode != 0:
            logger.error(
                "vpn bot apply failed rc=%s stdout=%s stderr=%s",
                proc.returncode,
                stdout,
                stderr,
            )
            return {
                "applied": False,
                "service_active": False,
                "message": stderr or stdout or f"apply failed (rc={proc.returncode})",
            }

        active = "service_active=1" in stdout or "active" in stdout.lower()
        return {
            "applied": True,
            "service_active": active if enabled else False,
            "message": stdout or ("Бот запущен" if enabled else "Бот остановлен"),
        }
    except subprocess.TimeoutExpired:
        return {
            "applied": False,
            "service_active": False,
            "message": "Таймаут применения токена на сервере",
        }
    except Exception as exc:
        logger.exception("vpn bot apply error")
        return {
            "applied": False,
            "service_active": False,
            "message": str(exc),
        }
    finally:
        if tmp_path is not None:
            try:
                tmp_path.unlink(missing_ok=True)
            except OSError:
                pass
