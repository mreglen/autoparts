#!/usr/bin/env python3
"""Удалённая сборка APK через EAS Build (запускается на сервере из админки).

Шаги: eas build (профиль apk) -> ожидание -> скачивание артефакта ->
копирование в frontend/my-autoparts/public/downloads и WEB_ROOT/downloads ->
обновление site_settings.mobile_apk_* (чтобы /api/mobile/meta отдал новую версию).

Запуск: <backend-venv>/python scripts/mobile/eas_build_apk.py [--notes "текст"]
Требуется EXPO_TOKEN в окружении (берётся из backend/.env).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = REPO_ROOT / "backend"
MOBILE_DIR = REPO_ROOT / "mobile" / "app"
PUBLIC_DOWNLOADS = REPO_ROOT / "frontend" / "my-autoparts" / "public" / "downloads"
WEB_ROOT = Path(os.environ.get("MOBILE_APK_WEB_ROOT", "/var/www/my-autoparts"))
STATE_PATH = BACKEND_DIR / "var" / "mobile-app-build-job.json"

_BUILD_URL_RE = re.compile(r"builds/([0-9a-fA-F-]{36})")
_APK_URL_RE = re.compile(r'"(?:buildUrl|applicationArchiveUrl|archiveUrl)"\s*:\s*"(https?://[^"]+)"')
_MIN_APK_BYTES = 1024 * 1024


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def write_state(payload: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(STATE_PATH)


def app_version() -> str:
    data = json.loads((MOBILE_DIR / "app.json").read_text(encoding="utf-8"))
    return str(data.get("expo", {}).get("version") or "0.0.0")


def run(cmd: list[str], cwd: Path, env: dict[str, str]) -> str:
    print(f"$ {' '.join(cmd)}", flush=True)
    proc = subprocess.run(
        cmd,
        cwd=str(cwd),
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if proc.stdout:
        print(proc.stdout, flush=True)
    if proc.stderr:
        print(proc.stderr, flush=True)
    if proc.returncode != 0:
        raise RuntimeError(f"Команда завершилась с кодом {proc.returncode}: {' '.join(cmd)}")
    return proc.stdout or ""


def eas(*args: str, cwd: Path = MOBILE_DIR, env: dict[str, str] | None = None) -> str:
    npx = shutil.which("npx") or "npx"
    return run([npx, "--yes", "eas-cli", *args], cwd=cwd, env=env or os.environ.copy())


def extract_build_id(text: str) -> str | None:
    matches = _BUILD_URL_RE.findall(text)
    return matches[-1] if matches else None


def find_artifact_url(build_id: str | None, env: dict[str, str], started_at: str) -> str:
    if build_id:
        out = eas("build:view", build_id, "--json", env=env)
        m = _APK_URL_RE.search(out)
        if m:
            return m.group(1)
    # Fallback: последний завершённый android-билд после старта джобы.
    out = eas("build:list", "--platform", "android", "--limit", "10", "--json", env=env)
    try:
        builds = json.loads(out)
    except json.JSONDecodeError:
        builds = []
    if isinstance(builds, dict):
        builds = builds.get("builds") or builds.get("data") or []
    started_dt = datetime.fromisoformat(started_at)
    candidates = []
    for b in builds if isinstance(builds, list) else []:
        if not isinstance(b, dict):
            continue
        if str(b.get("status") or "").upper() != "FINISHED":
            continue
        artifacts = b.get("artifacts") or {}
        url = artifacts.get("buildUrl") or artifacts.get("applicationArchiveUrl")
        created_raw = str(b.get("createdAt") or b.get("created_at") or "")
        try:
            created_dt = datetime.fromisoformat(created_raw.replace("Z", "+00:00"))
        except ValueError:
            continue
        if url and created_dt >= started_dt:
            candidates.append((created_dt, url))
    if not candidates:
        raise RuntimeError("Не удалось получить URL артефакта сборки (build:view/build:list)")
    candidates.sort(key=lambda item: item[0])
    return candidates[-1][1]


def download_apk(url: str, dest: Path) -> None:
    print(f"Скачивание {url}", flush=True)
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "autoparts-eas-build/1.0"})
    with urllib.request.urlopen(req, timeout=600) as resp, open(dest, "wb") as f:
        shutil.copyfileobj(resp, f, length=1024 * 256)
    size = dest.stat().st_size
    if size < _MIN_APK_BYTES:
        raise RuntimeError(f"Скачанный файл слишком маленький ({size} байт) — это не APK")
    with open(dest, "rb") as f:
        if f.read(2) != b"PK":
            raise RuntimeError("Скачанный файл не похож на APK (нет ZIP-сигнатуры)")
    print(f"APK сохранён: {dest} ({size} байт)", flush=True)


def publish_apk(version: str, apk_path: Path, notes: str | None, build_id: str | None) -> str:
    name = f"sg-autoservice-{version}.apk"
    PUBLIC_DOWNLOADS.mkdir(parents=True, exist_ok=True)
    targets = [PUBLIC_DOWNLOADS / name]
    web_dir = WEB_ROOT / "downloads"
    try:
        web_dir.mkdir(parents=True, exist_ok=True)
        targets.append(web_dir / name)
    except OSError as e:
        print(f"WARN: не удалось подготовить {web_dir}: {e}", flush=True)
    for target in targets:
        shutil.copy2(apk_path, target)
        print(f"Опубликовано: {target}", flush=True)

    # backend/.env подхватывается pydantic-settings относительно cwd
    os.chdir(BACKEND_DIR)
    sys.path.insert(0, str(BACKEND_DIR))
    from app.db.database import SessionLocal  # noqa: E402
    from app.utils.site_settings_db import get_or_create_site_settings  # noqa: E402

    db = SessionLocal()
    try:
        row = get_or_create_site_settings(db)
        row.mobile_apk_version = version
        row.mobile_apk_url = f"/downloads/{name}"
        if notes:
            row.mobile_apk_notes = notes
        db.commit()
    finally:
        db.close()
    if build_id:
        print(f"site_settings обновлены (build {build_id})", flush=True)
    return f"/downloads/{name}"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--notes", default=None, help="Примечание к обновлению в приложении")
    args = parser.parse_args()

    if os.name == "nt":
        print("Сборка доступна только на Linux-сервере", flush=True)
        return 1
    if not os.environ.get("EXPO_TOKEN", "").strip():
        print("EXPO_TOKEN не задан (нужен в backend/.env на сервере)", flush=True)
        return 1
    if not (MOBILE_DIR / "app.json").is_file():
        print(f"mobile/app не найден: {MOBILE_DIR}", flush=True)
        return 1

    version = app_version()
    started_at = utc_now_iso()
    state = {
        "status": "running",
        "started_at": started_at,
        "version": version,
        "build_id": None,
        "apk": None,
        "error": None,
    }
    write_state(state)

    env = dict(os.environ)
    env["CI"] = "1"
    env["EXPO_NO_TELEMETRY"] = "1"

    try:
        build_out = ""
        try:
            build_out = eas(
                "build", "-p", "android", "--profile", "apk",
                "--non-interactive", env=env,
            )
        except RuntimeError as e:
            # eas build может вернуть 0, но статус сборки — ошибка: проверяем по логу ниже.
            print(f"eas build завершился с ошибкой: {e}", flush=True)
            raise
        build_id = extract_build_id(build_out)
        state["build_id"] = build_id
        write_state(state)

        artifact_url = find_artifact_url(build_id, env, started_at)
        with tempfile.TemporaryDirectory(prefix="sg-apk-") as tmp:
            apk_tmp = Path(tmp) / f"sg-autoservice-{version}.apk"
            download_apk(artifact_url, apk_tmp)
            url_path = publish_apk(version, apk_tmp, args.notes, build_id)

        state.update(
            status="ok",
            finished_at=utc_now_iso(),
            apk={"version": version, "url": url_path, "build_id": build_id},
        )
        write_state(state)
        print(f"Готово: {url_path}", flush=True)
        return 0
    except Exception as e:  # noqa: BLE001 — финальный статус пишем в state
        print(f"ОШИБКА: {e}", flush=True)
        state.update(status="error", finished_at=utc_now_iso(), error=str(e))
        write_state(state)
        return 1


if __name__ == "__main__":
    sys.exit(main())
