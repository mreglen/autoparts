"""Удалённая сборка мобильного APK через EAS Build (async, detached).

Скрипт scripts/mobile/eas_build_apk.py сам пишет state-файл
backend/var/mobile-app-build-job.json (running -> ok/error) и лог.
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
BACKEND_ROOT = REPO_ROOT / "backend"
load_dotenv(BACKEND_ROOT / ".env")
MOBILE_DIR = REPO_ROOT / "mobile" / "app"
SCRIPT_PATH = REPO_ROOT / "scripts" / "mobile" / "eas_build_apk.py"
PUBLIC_DOWNLOADS = REPO_ROOT / "frontend" / "my-autoparts" / "public" / "downloads"
WEB_ROOT = Path(os.environ.get("MOBILE_APK_WEB_ROOT", "/var/www/my-autoparts"))
STATE_PATH = BACKEND_ROOT / "var" / "mobile-app-build-job.json"
LOG_PATH = BACKEND_ROOT / "var" / "mobile-app-build.log"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _read_state() -> dict[str, Any] | None:
    try:
        if not STATE_PATH.is_file():
            return None
        data = json.loads(STATE_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except Exception:
        logger.exception("Failed to read mobile app build state")
        return None


def _tail_log(max_lines: int = 60) -> list[str]:
    try:
        if not LOG_PATH.is_file():
            return []
        lines = LOG_PATH.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return []
    return [ln for ln in lines if ln.strip()][-max_lines:]


def _pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def is_build_running() -> bool:
    if os.name == "nt":
        return False
    state = _read_state()
    if not state or state.get("status") != "running":
        return False
    pid = state.get("pid")
    if isinstance(pid, int) and _pid_alive(pid):
        return True
    try:
        proc = subprocess.run(
            ["pgrep", "-f", "eas_build_apk.py"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        return proc.returncode == 0 and bool((proc.stdout or "").strip())
    except Exception:
        logger.debug("pgrep eas_build_apk failed", exc_info=True)
        return False


def _latest_published_apk() -> dict[str, Any] | None:
    best: Path | None = None
    for directory in (PUBLIC_DOWNLOADS, WEB_ROOT / "downloads"):
        try:
            for apk in directory.glob("*.apk"):
                if best is None or apk.stat().st_mtime > best.stat().st_mtime:
                    best = apk
        except OSError:
            continue
    if best is None:
        return None
    stat = best.stat()
    return {
        "name": best.name,
        "size_bytes": stat.st_size,
        "updated_at": datetime.fromtimestamp(stat.st_mtime, timezone.utc)
        .replace(microsecond=0)
        .isoformat(),
        "url": f"/downloads/{best.name}",
    }


def check_can_run() -> tuple[bool, str | None]:
    if os.name == "nt":
        return False, "Сборка APK доступна только на Linux-сервере"
    if not SCRIPT_PATH.is_file():
        return False, f"Скрипт сборки не найден: {SCRIPT_PATH}"
    if not (MOBILE_DIR / "app.json").is_file():
        return False, "Каталог mobile/app не найден на сервере — нужен деплой репозитория"
    if not (MOBILE_DIR / "node_modules").is_dir():
        return False, "В mobile/app нет node_modules — запустите обновление на сервере"
    if not os.environ.get("EXPO_TOKEN", "").strip():
        return False, "EXPO_TOKEN не задан — добавьте его в backend/.env на сервере"
    try:
        proc = subprocess.run(
            ["bash", "-lc", "command -v npx"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False, "npx недоступен на сервере"
    if proc.returncode != 0 or not (proc.stdout or "").strip():
        return False, "npx недоступен на сервере"
    return True, None


def get_build_status() -> dict[str, Any]:
    running = is_build_running()
    state = _read_state() or {}
    status = state.get("status") or "idle"
    if running and status != "running":
        status = "running"
    elif not running and status == "running":
        # Процесс завершился, но state не обновлён (например, сервер перезагружался)
        status = "unknown"
    can_run, reason = check_can_run()
    return {
        "status": status,
        "running": running,
        "can_run": can_run and not running,
        "reason": reason,
        "started_at": state.get("started_at"),
        "finished_at": state.get("finished_at"),
        "version": state.get("version"),
        "build_id": state.get("build_id"),
        "apk": state.get("apk") or _latest_published_apk(),
        "error": state.get("error"),
        "log_tail": _tail_log(),
    }


def start_build(*, user_id: int | None = None, notes: str | None = None) -> dict[str, Any]:
    if is_build_running():
        raise RuntimeError("Сборка APK уже выполняется")

    can_run, reason = check_can_run()
    if not can_run:
        raise RuntimeError(reason or "Сборка APK недоступна")

    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

    env = dict(os.environ)
    env.setdefault("EXPO_NO_TELEMETRY", "1")
    cmd = [sys.executable, str(SCRIPT_PATH)]
    if notes:
        cmd += ["--notes", notes]

    with open(LOG_PATH, "ab") as log:
        log.write(f"\n--- {' '.join(cmd)} @ {_utc_now_iso()} ---\n".encode())
        log.flush()
        proc = subprocess.Popen(
            cmd,
            cwd=str(REPO_ROOT),
            stdout=log,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            start_new_session=True,
            close_fds=True,
            env=env,
        )

    _write_started_state(user_id=user_id, pid=proc.pid)
    logger.warning("Mobile APK build started by user_id=%s pid=%s", user_id, proc.pid)
    return get_build_status()


def _write_started_state(*, user_id: int | None, pid: int) -> None:
    payload = {
        "status": "running",
        "started_at": _utc_now_iso(),
        "started_by_user_id": user_id,
        "pid": pid,
        "version": None,
        "build_id": None,
        "apk": None,
        "error": None,
    }
    tmp = STATE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(STATE_PATH)
