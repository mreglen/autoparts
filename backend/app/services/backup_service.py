from __future__ import annotations

import gzip
import logging
import os
import re
import shutil
import subprocess
import tarfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from sqlalchemy.engine import make_url

from app.core.config import settings

logger = logging.getLogger(__name__)

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_UPLOADS_DIR = BACKEND_ROOT / "uploads"
BACKUP_FILENAME_RE = re.compile(
    r"^(db|uploads)-(manual|scheduled)-(\d{8}-\d{6})\.(sql\.gz|tar\.gz)$"
)

BackupType = Literal["db", "uploads"]
BackupTrigger = Literal["manual", "scheduled"]


@dataclass(frozen=True)
class BackupItem:
    id: str
    backup_type: BackupType
    trigger: BackupTrigger
    filename: str
    size_bytes: int
    created_at: str

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "backup_type": self.backup_type,
            "trigger": self.trigger,
            "filename": self.filename,
            "size_bytes": self.size_bytes,
            "created_at": self.created_at,
        }


def get_backup_dir() -> Path:
    if settings.BACKUP_DIR:
        path = Path(settings.BACKUP_DIR).expanduser()
    else:
        path = BACKEND_ROOT / "backups"
    path.mkdir(parents=True, exist_ok=True)
    return path.resolve()


def get_uploads_dir() -> Path:
    return DEFAULT_UPLOADS_DIR.resolve()


def _timestamp_label(now: datetime | None = None) -> str:
    moment = now or datetime.now(timezone.utc)
    return moment.strftime("%Y%m%d-%H%M%S")


def _build_filename(backup_type: BackupType, trigger: BackupTrigger, now: datetime | None = None) -> str:
    stamp = _timestamp_label(now)
    if backup_type == "db":
        return f"db-{trigger}-{stamp}.sql.gz"
    return f"uploads-{trigger}-{stamp}.tar.gz"


def _parse_backup_filename(filename: str) -> BackupItem | None:
    match = BACKUP_FILENAME_RE.match(filename)
    if not match:
        return None
    backup_type, trigger, stamp, _ext = match.groups()
    try:
        created = datetime.strptime(stamp, "%Y%m%d-%H%M%S").replace(tzinfo=timezone.utc)
    except ValueError:
        created = datetime.fromtimestamp(0, tz=timezone.utc)
    path = get_backup_dir() / filename
    if not path.is_file():
        return None
    return BackupItem(
        id=filename,
        backup_type=backup_type,  # type: ignore[arg-type]
        trigger=trigger,  # type: ignore[arg-type]
        filename=filename,
        size_bytes=path.stat().st_size,
        created_at=created.isoformat(),
    )


def list_backups() -> list[BackupItem]:
    items: list[BackupItem] = []
    for path in sorted(get_backup_dir().iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        if not path.is_file():
            continue
        item = _parse_backup_filename(path.name)
        if item is not None:
            items.append(item)
    return items


def resolve_backup_path(backup_id: str) -> Path:
    if not backup_id or backup_id != Path(backup_id).name:
        raise ValueError("Некорректный идентификатор резервной копии")
    if ".." in backup_id or "/" in backup_id or "\\" in backup_id:
        raise ValueError("Некорректный идентификатор резервной копии")
    path = (get_backup_dir() / backup_id).resolve()
    if path.parent != get_backup_dir():
        raise ValueError("Некорректный идентификатор резервной копии")
    if not path.is_file():
        raise FileNotFoundError("Резервная копия не найдена")
    return path


def _ensure_pg_dump_available() -> str:
    configured = (settings.PG_DUMP_PATH or "").strip()
    if configured:
        candidate = Path(configured).expanduser()
        if candidate.is_file():
            return str(candidate)
        raise RuntimeError(f"PG_DUMP_PATH указывает на несуществующий файл: {candidate}")

    pg_dump = shutil.which("pg_dump")
    if pg_dump:
        return pg_dump

    common_candidates = [
        Path(r"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"),
        Path(r"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"),
        Path(r"C:\Program Files\PostgreSQL\15\bin\pg_dump.exe"),
        Path(r"C:\Program Files\PostgreSQL\14\bin\pg_dump.exe"),
        Path(r"C:\Program Files\PostgreSQL\13\bin\pg_dump.exe"),
        Path("/usr/bin/pg_dump"),
        Path("/usr/local/bin/pg_dump"),
    ]
    for candidate in common_candidates:
        if candidate.is_file():
            return str(candidate)

    raise RuntimeError(
        "Утилита pg_dump не найдена. Установите PostgreSQL client tools и добавьте pg_dump в PATH "
        "или задайте полный путь в переменной PG_DUMP_PATH."
    )


def _database_url_supports_backup() -> bool:
    driver = make_url(settings.DATABASE_URL).drivername
    return driver.startswith("postgresql")


def create_database_backup(*, trigger: BackupTrigger = "manual") -> BackupItem:
    if not _database_url_supports_backup():
        raise RuntimeError("Резервное копирование БД поддерживается только для PostgreSQL")

    pg_dump = _ensure_pg_dump_available()
    url = make_url(settings.DATABASE_URL)
    host = url.host or "localhost"
    port = str(url.port or 5432)
    user = url.username or ""
    password = url.password or ""
    dbname = url.database or ""
    if not dbname:
        raise RuntimeError("Не удалось определить имя базы данных из DATABASE_URL")

    filename = _build_filename("db", trigger)
    output_path = get_backup_dir() / filename

    env = os.environ.copy()
    if password:
        env["PGPASSWORD"] = password

    cmd = [
        pg_dump,
        "-h",
        host,
        "-p",
        port,
        "-U",
        user,
        "-d",
        dbname,
        "--no-owner",
        "--no-acl",
    ]
    result = subprocess.run(cmd, capture_output=True, env=env, check=False)
    if result.returncode != 0:
        stderr = (result.stderr or b"").decode("utf-8", errors="replace").strip()
        raise RuntimeError(stderr or "pg_dump завершился с ошибкой")

    with gzip.open(output_path, "wb") as gz_file:
        gz_file.write(result.stdout)

    item = _parse_backup_filename(filename)
    if item is None:
        raise RuntimeError("Не удалось создать резервную копию базы данных")
    logger.info("Database backup created: %s (%s bytes)", filename, item.size_bytes)
    return item


def _should_skip_uploads_path(path: Path, uploads_root: Path) -> bool:
    try:
        rel = path.relative_to(uploads_root)
    except ValueError:
        return True
    parts = rel.parts
    if parts and parts[0] == "temp":
        return True
    return False


def create_uploads_backup(*, trigger: BackupTrigger = "manual") -> BackupItem:
    uploads_dir = get_uploads_dir()
    if not uploads_dir.exists():
        raise RuntimeError(f"Каталог uploads не найден: {uploads_dir}")

    filename = _build_filename("uploads", trigger)
    output_path = get_backup_dir() / filename

    with tarfile.open(output_path, "w:gz") as archive:
        for item in sorted(uploads_dir.rglob("*")):
            if _should_skip_uploads_path(item, uploads_dir):
                continue
            archive.add(item, arcname=str(Path("uploads") / item.relative_to(uploads_dir)))

    item = _parse_backup_filename(filename)
    if item is None:
        raise RuntimeError("Не удалось создать резервную копию uploads")
    logger.info("Uploads backup created: %s (%s bytes)", filename, item.size_bytes)
    return item


def cleanup_old_backups(*, retention: int | None = None) -> dict[str, int]:
    keep = retention if retention is not None else int(settings.BACKUP_RETENTION_COUNT or 8)
    keep = max(1, keep)
    removed = {"db": 0, "uploads": 0}

    for backup_type in ("db", "uploads"):
        typed = [item for item in list_backups() if item.backup_type == backup_type]
        for item in typed[keep:]:
            try:
                resolve_backup_path(item.id).unlink(missing_ok=True)
                removed[backup_type] += 1
            except OSError:
                logger.exception("Failed to remove old backup %s", item.id)

    return removed


def run_scheduled_backups() -> dict:
    db_item = create_database_backup(trigger="scheduled")
    uploads_item = create_uploads_backup(trigger="scheduled")
    removed = cleanup_old_backups()
    return {
        "database": db_item.to_dict(),
        "uploads": uploads_item.to_dict(),
        "removed": removed,
    }
