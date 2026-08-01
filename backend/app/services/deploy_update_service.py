"""Trigger production `update` script from admin UI (async, detached)."""

from __future__ import annotations

import fcntl
import json
import logging
import os
import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

UPDATE_BIN = Path("/usr/local/bin/update")
LOG_PATH = Path("/var/log/autoparts-update.log")
LOCK_PATH = Path("/var/run/autoparts-update.lock")
BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
STATE_PATH = BACKEND_ROOT / "var" / "deploy-update-job.json"

_START_MARK = "========== Старт обновления =========="
_DONE_MARK = "========== Обновление завершено =========="
_ERROR_RE = re.compile(r"\bERROR:", re.IGNORECASE)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _read_state() -> dict[str, Any] | None:
    try:
        if not STATE_PATH.is_file():
            return None
        data = json.loads(STATE_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except Exception:
        logger.exception("Failed to read deploy update state")
        return None


def _write_state(payload: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(STATE_PATH)


def is_update_running() -> bool:
    if UPDATE_BIN.is_file():
        try:
            proc = subprocess.run(
                ["pgrep", "-f", r"/usr/local/bin/update"],
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )
            if proc.returncode == 0 and (proc.stdout or "").strip():
                return True
        except Exception:
            logger.debug("pgrep update failed", exc_info=True)

    if not LOCK_PATH.exists():
        return False
    try:
        fd = os.open(str(LOCK_PATH), os.O_RDONLY)
    except OSError:
        return False
    try:
        fcntl.flock(fd, fcntl.LOCK_SH | fcntl.LOCK_NB)
        fcntl.flock(fd, fcntl.LOCK_UN)
        return False
    except BlockingIOError:
        return True
    except OSError:
        return False
    finally:
        os.close(fd)


def _tail_log(max_lines: int = 40) -> list[str]:
    if not LOG_PATH.is_file():
        return []
    try:
        text = LOG_PATH.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return []
    lines = [ln for ln in text.splitlines() if ln.strip()]
    return lines[-max_lines:]


def _infer_last_result(log_lines: list[str]) -> str | None:
    """Return ok | error | None based on last update cycle in the log."""
    start_idx = None
    for i in range(len(log_lines) - 1, -1, -1):
        if _START_MARK in log_lines[i]:
            start_idx = i
            break
    if start_idx is None:
        return None
    chunk = log_lines[start_idx:]
    for line in reversed(chunk):
        if _DONE_MARK in line:
            return "ok"
        if _ERROR_RE.search(line):
            return "error"
    return None


def check_can_run() -> tuple[bool, str | None]:
    if os.name == "nt":
        return False, "Запуск update доступен только на Linux-сервере"
    if not UPDATE_BIN.is_file():
        return False, f"Скрипт не найден: {UPDATE_BIN}"
    try:
        # Lists whether NOPASSWD allows this exact binary (no side effects).
        proc = subprocess.run(
            ["sudo", "-n", "-l", "--", str(UPDATE_BIN)],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except FileNotFoundError:
        return False, "Команда sudo недоступна"
    except subprocess.TimeoutExpired:
        return False, "Проверка sudo зависла (timeout)"
    out = f"{proc.stdout or ''}{proc.stderr or ''}"
    if proc.returncode != 0 or str(UPDATE_BIN) not in out:
        hint = (
            "Нет права запускать update от root. "
            "На сервере один раз выполните: sudo update "
            "(установит sudoers для пользователя fast)."
        )
        err = out.strip()
        return False, f"{hint}" + (f" ({err[:200]})" if err else "")
    return True, None


def get_deploy_update_status() -> dict[str, Any]:
    running = is_update_running()
    can_run, reason = check_can_run()
    log_lines = _tail_log()
    last_result = _infer_last_result(log_lines)
    state = _read_state() or {}

    status = "idle"
    if running:
        status = "running"
    elif last_result == "ok" and state.get("started_at"):
        status = "ok"
    elif last_result == "error" and state.get("started_at"):
        status = "error"
    elif state.get("started_at") and not running and last_result is None:
        # Started recently but log not finished yet / API just came back
        started = state.get("started_at")
        try:
            started_dt = datetime.fromisoformat(str(started).replace("Z", "+00:00"))
            age = (datetime.now(timezone.utc) - started_dt).total_seconds()
            if age < 900:
                status = "running"
            elif last_result == "ok":
                status = "ok"
            else:
                status = "unknown"
        except Exception:
            status = "unknown"

    return {
        "status": status,
        "running": running or status == "running",
        "can_run": can_run,
        "reason": reason,
        "update_bin": str(UPDATE_BIN),
        "log_path": str(LOG_PATH),
        "started_at": state.get("started_at"),
        "started_by_user_id": state.get("started_by_user_id"),
        "last_result": last_result,
        "log_tail": log_lines,
    }


def start_deploy_update(*, user_id: int | None = None) -> dict[str, Any]:
    if is_update_running():
        raise RuntimeError("Обновление уже выполняется")

    can_run, reason = check_can_run()
    if not can_run:
        raise RuntimeError(reason or "Запуск update недоступен")

    started_at = _utc_now_iso()
    _write_state(
        {
            "started_at": started_at,
            "started_by_user_id": user_id,
            "pid": None,
        }
    )

    # Detach fully: update restarts kroan; child must outlive this worker.
    # Logging is handled inside update.sh (tee -> /var/log/autoparts-update.log).
    proc = subprocess.Popen(
        ["sudo", "-n", str(UPDATE_BIN)],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
        close_fds=True,
    )

    _write_state(
        {
            "started_at": started_at,
            "started_by_user_id": user_id,
            "pid": proc.pid,
        }
    )
    logger.warning(
        "Deploy update started by user_id=%s pid=%s",
        user_id,
        proc.pid,
    )
    # Brief pause so lock/pgrep can appear before status poll
    time.sleep(0.3)
    return get_deploy_update_status()
