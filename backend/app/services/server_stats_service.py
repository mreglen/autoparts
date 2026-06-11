from __future__ import annotations

import os
import platform
import socket
import time
from datetime import datetime, timezone
from typing import Optional

import psutil
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.schemas.server_stats import (
    CpuStats,
    DiskStats,
    MemoryStats,
    ProcessStats,
    ServerStatsOut,
    ServiceHealth,
)

_SKIP_FS_TYPES = frozenset(
    {"tmpfs", "devtmpfs", "devfs", "overlay", "squashfs", "iso9660", "cgroup", "cgroup2"}
)
_PREFERRED_MOUNTS = ("/", "/var", "/home")
_CPU_INTERVAL = 0.2


def _read_os_version() -> str:
    try:
        with open("/etc/os-release", encoding="utf-8") as handle:
            for line in handle:
                if line.startswith("PRETTY_NAME="):
                    value = line.split("=", 1)[1].strip().strip('"')
                    if value:
                        return value
    except OSError:
        pass
    return platform.platform()


def _load_averages() -> tuple[Optional[float], Optional[float], Optional[float]]:
    try:
        load_1m, load_5m, load_15m = os.getloadavg()
        return float(load_1m), float(load_5m), float(load_15m)
    except (AttributeError, OSError):
        return None, None, None


def _collect_disks() -> list[DiskStats]:
    seen_mounts: set[str] = set()
    disks: list[DiskStats] = []

    def add_disk(mountpoint: str) -> None:
        if mountpoint in seen_mounts:
            return
        try:
            usage = psutil.disk_usage(mountpoint)
        except (OSError, PermissionError):
            return
        seen_mounts.add(mountpoint)
        disks.append(
            DiskStats(
                mount=mountpoint,
                total_bytes=usage.total,
                used_bytes=usage.used,
                free_bytes=usage.free,
                percent=float(usage.percent),
            )
        )

    for mount in _PREFERRED_MOUNTS:
        add_disk(mount)

    for part in psutil.disk_partitions(all=False):
        fstype = (part.fstype or "").lower()
        if fstype in _SKIP_FS_TYPES:
            continue
        if part.mountpoint.startswith(("/proc", "/sys", "/dev", "/run/user")):
            continue
        add_disk(part.mountpoint)

    disks.sort(key=lambda row: (row.mount != "/", row.mount))
    return disks


def _collect_process_stats() -> ProcessStats:
    proc = psutil.Process(os.getpid())
    with proc.oneshot():
        mem = proc.memory_info()
        create_time = proc.create_time()
    return ProcessStats(
        pid=proc.pid,
        memory_rss_bytes=int(mem.rss),
        cpu_percent=float(proc.cpu_percent(interval=_CPU_INTERVAL)),
        threads=int(proc.num_threads()),
        uptime_seconds=max(0.0, time.time() - create_time),
    )


def _check_postgresql(db: Session) -> ServiceHealth:
    started = time.perf_counter()
    try:
        db.execute(text("SELECT 1"))
        latency_ms = (time.perf_counter() - started) * 1000
        return ServiceHealth(name="PostgreSQL", ok=True, latency_ms=round(latency_ms, 1))
    except Exception as exc:
        return ServiceHealth(name="PostgreSQL", ok=False, detail=str(exc))


def _check_redis() -> ServiceHealth:
    started = time.perf_counter()
    client = None
    try:
        import redis

        client = redis.from_url(settings.REDIS_URL, socket_connect_timeout=1, socket_timeout=1)
        client.ping()
        latency_ms = (time.perf_counter() - started) * 1000
        return ServiceHealth(name="Redis", ok=True, latency_ms=round(latency_ms, 1))
    except Exception as exc:
        return ServiceHealth(name="Redis", ok=False, detail=str(exc))
    finally:
        if client is not None:
            try:
                client.close()
            except Exception:
                pass


def _check_celery() -> ServiceHealth:
    started = time.perf_counter()
    try:
        from app.celery_app import celery_app

        replies = celery_app.control.ping(timeout=2.0)
        latency_ms = (time.perf_counter() - started) * 1000
        if not replies:
            return ServiceHealth(
                name="Celery worker",
                ok=False,
                latency_ms=round(latency_ms, 1),
                detail="нет активных worker",
            )
        worker_count = len(replies)
        return ServiceHealth(
            name="Celery worker",
            ok=True,
            latency_ms=round(latency_ms, 1),
            detail=f"{worker_count} worker(s)",
        )
    except Exception as exc:
        return ServiceHealth(name="Celery worker", ok=False, detail=str(exc))


def _build_warnings(
    *,
    cpu: CpuStats,
    memory: MemoryStats,
    disks: list[DiskStats],
) -> list[str]:
    warnings: list[str] = []
    if cpu.usage_percent > 85:
        warnings.append(f"Высокая загрузка CPU: {cpu.usage_percent:.1f}%")
    if memory.percent > 85:
        warnings.append(f"Высокая загрузка RAM: {memory.percent:.1f}%")
    if cpu.load_avg_1m is not None and cpu.load_avg_1m > cpu.cores_logical * 1.5:
        warnings.append(
            f"Load average 1m ({cpu.load_avg_1m:.2f}) выше нормы для {cpu.cores_logical} ядер"
        )
    for disk in disks:
        if disk.percent > 90:
            warnings.append(f"Диск {disk.mount} заполнен на {disk.percent:.1f}%")
    return warnings


def collect_server_stats(db: Session) -> ServerStatsOut:
    now = datetime.now(timezone.utc)
    boot_ts = psutil.boot_time()
    boot_time = datetime.fromtimestamp(boot_ts, tz=timezone.utc)
    uptime_seconds = max(0.0, time.time() - boot_ts)

    load_1m, load_5m, load_15m = _load_averages()
    cores_logical = psutil.cpu_count(logical=True) or 1
    cores_physical = psutil.cpu_count(logical=False)

    cpu = CpuStats(
        cores_logical=cores_logical,
        cores_physical=cores_physical,
        usage_percent=float(psutil.cpu_percent(interval=_CPU_INTERVAL)),
        load_avg_1m=load_1m,
        load_avg_5m=load_5m,
        load_avg_15m=load_15m,
    )

    vm = psutil.virtual_memory()
    swap = psutil.swap_memory()
    memory = MemoryStats(
        total_bytes=int(vm.total),
        used_bytes=int(vm.used),
        available_bytes=int(vm.available),
        percent=float(vm.percent),
        swap_total_bytes=int(swap.total) if swap.total else None,
        swap_used_bytes=int(swap.used) if swap.total else None,
        swap_percent=float(swap.percent) if swap.total else None,
    )

    disks = _collect_disks()
    process = _collect_process_stats()
    services = [
        _check_postgresql(db),
        _check_redis(),
        _check_celery(),
    ]
    warnings = _build_warnings(cpu=cpu, memory=memory, disks=disks)

    return ServerStatsOut(
        collected_at=now,
        hostname=socket.gethostname(),
        platform=platform.system(),
        os_version=_read_os_version(),
        architecture=platform.machine(),
        python_version=platform.python_version(),
        boot_time=boot_time,
        uptime_seconds=uptime_seconds,
        cpu=cpu,
        memory=memory,
        disks=disks,
        process=process,
        services=services,
        warnings=warnings,
    )
