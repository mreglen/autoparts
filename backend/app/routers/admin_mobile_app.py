# app/routers/admin_mobile_app.py
"""Управление dev-запуском мобильного приложения (expo start --tunnel) на сервере."""

import os
import re
import signal
import subprocess
import time
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_admin_user
from app.models.user import User
from app.services import mobile_app_build_service as build_service

router = APIRouter(prefix="/admin/mobile-app", tags=["Admin"])

REPO_ROOT = Path(__file__).resolve().parents[3]
MOBILE_DIR = REPO_ROOT / "mobile" / "app"
RUNTIME_DIR = MOBILE_DIR / ".expo-dev"
PID_FILE = RUNTIME_DIR / "expo.pid"
LOG_FILE = RUNTIME_DIR / "expo.log"

_URL_RE = re.compile(r"(exp://[^\s]+|https?://[^\s]*on\.expo\.app[^\s]*)")
_PUBLIC_IP_CACHE: Optional[str] = None


def _public_ip() -> Optional[str]:
    global _PUBLIC_IP_CACHE
    if _PUBLIC_IP_CACHE:
        return _PUBLIC_IP_CACHE
    env_ip = os.environ.get("EXPO_PUBLIC_IP", "").strip()
    if re.match(r"^\d+\.\d+\.\d+\.\d+$", env_ip):
        _PUBLIC_IP_CACHE = env_ip
        return env_ip
    try:
        out = subprocess.run(
            ["curl", "-s", "--max-time", "5", "https://ifconfig.me"],
            capture_output=True,
            text=True,
            timeout=8,
        ).stdout.strip()
        if re.match(r"^\d+\.\d+\.\d+\.\d+$", out):
            _PUBLIC_IP_CACHE = out
    except (OSError, subprocess.SubprocessError):
        pass
    return _PUBLIC_IP_CACHE


def _find_expo_url() -> Optional[str]:
    try:
        data = LOG_FILE.read_bytes()[-300_000:].decode("utf-8", "ignore")
    except OSError:
        return None
    matches = _URL_RE.findall(data)
    if not matches:
        return None
    url = matches[-1].rstrip(".,)")
    if "on.expo.app" in url:
        if url.startswith("http"):
            host = re.sub(r"^https?://", "", url).split(":")[0]
            return f"exp://{host}"
        return url
    # LAN-режим: exp://<локальный-ip>:<port> → подменяем хост на публичный IP сервера
    m = re.match(r"exp://[^:/]+:(\d+)", url)
    if m:
        pub = _public_ip()
        if pub:
            return f"exp://{pub}:{m.group(1)}"
    return url


def _pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    try:
        with open(f"/proc/{pid}/cmdline", "rb") as f:
            return b"expo" in f.read()
    except OSError:
        return True


def _read_pid() -> Optional[int]:
    try:
        return int(PID_FILE.read_text().strip())
    except (OSError, ValueError):
        return None


def _find_expo_pid() -> Optional[int]:
    try:
        out = subprocess.run(
            ["pgrep", "-f", "expo start"],
            capture_output=True,
            text=True,
            timeout=5,
        ).stdout.split()
    except (OSError, subprocess.SubprocessError):
        return None
    for token in out:
        try:
            pid = int(token)
        except ValueError:
            continue
        if pid != os.getpid():
            return pid
    return None


def _status() -> dict:
    pid = _read_pid()
    running = pid is not None and _pid_alive(pid)
    if not running:
        alt = _find_expo_pid()
        running = alt is not None
        pid = alt if running else None
    return {
        "running": running,
        "pid": pid if running else None,
        "url": _find_expo_url() if running else None,
        "mobile_dir_exists": MOBILE_DIR.is_dir(),
        "node_modules_exists": (MOBILE_DIR / "node_modules").is_dir(),
    }


@router.get("/expo/status")
def expo_status(current_user: User = Depends(get_current_admin_user)):
    return _status()


@router.post("/expo/start")
def expo_start(current_user: User = Depends(get_current_admin_user)):
    st = _status()
    if st["running"]:
        return {"started": True, "already_running": True, **st}
    if not st["mobile_dir_exists"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Каталог mobile/app не найден на сервере",
        )
    npx = (
        subprocess.run(
            ["bash", "-lc", "command -v npx || command -v npm"],
            capture_output=True,
            text=True,
            timeout=10,
        ).stdout.strip()
        or "npx"
    )
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ)
    env["EXPO_NO_TELEMETRY"] = "1"
    use_tunnel = os.environ.get("EXPO_TUNNEL", "").lower() in ("1", "true", "yes")
    cmd = [npx, "expo", "start"]
    cmd += ["--tunnel"] if use_tunnel else ["--host", "lan"]
    with open(LOG_FILE, "ab") as log:
        log.write(f"\n--- {' '.join(cmd)} ---\n".encode())
        log.flush()
        proc = subprocess.Popen(
            cmd,
            cwd=str(MOBILE_DIR),
            stdout=log,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            start_new_session=True,
            env=env,
        )
    PID_FILE.write_text(str(proc.pid))
    return {"started": True, "already_running": False, "pid": proc.pid, **_status()}


@router.post("/expo/stop")
def expo_stop(current_user: User = Depends(get_current_admin_user)):
    pid = _read_pid() or _find_expo_pid()
    if pid is None:
        return {"stopped": True, "was_running": False}
    was_running = _pid_alive(pid)
    if was_running:
        try:
            os.killpg(os.getpgid(pid), signal.SIGTERM)
        except OSError:
            try:
                os.kill(pid, signal.SIGTERM)
            except OSError:
                pass
        for _ in range(30):
            if not _pid_alive(pid):
                break
            time.sleep(0.2)
        if _pid_alive(pid):
            try:
                os.killpg(os.getpgid(pid), signal.SIGKILL)
            except OSError:
                try:
                    os.kill(pid, signal.SIGKILL)
                except OSError:
                    pass
    try:
        PID_FILE.unlink()
    except OSError:
        pass
    return {"stopped": True, "was_running": was_running}


class MobileAppBuildStartRequest(BaseModel):
    notes: Optional[str] = Field(None, max_length=500)


@router.get("/build/status")
def build_status(current_user: User = Depends(get_current_admin_user)):
    return build_service.get_build_status()


@router.post("/build/start")
def build_start(
    payload: Optional[MobileAppBuildStartRequest] = None,
    current_user: User = Depends(get_current_admin_user),
):
    notes = (payload.notes or "").strip() if payload else ""
    try:
        return build_service.start_build(user_id=current_user.id, notes=notes or None)
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
