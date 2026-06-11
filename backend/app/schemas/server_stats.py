from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CpuStats(BaseModel):
    cores_logical: int
    cores_physical: Optional[int] = None
    usage_percent: float
    load_avg_1m: Optional[float] = None
    load_avg_5m: Optional[float] = None
    load_avg_15m: Optional[float] = None


class MemoryStats(BaseModel):
    total_bytes: int
    used_bytes: int
    available_bytes: int
    percent: float
    swap_total_bytes: Optional[int] = None
    swap_used_bytes: Optional[int] = None
    swap_percent: Optional[float] = None


class DiskStats(BaseModel):
    mount: str
    total_bytes: int
    used_bytes: int
    free_bytes: int
    percent: float


class ProcessStats(BaseModel):
    pid: int
    memory_rss_bytes: int
    cpu_percent: float
    threads: int
    uptime_seconds: float


class ServiceHealth(BaseModel):
    name: str
    ok: bool
    latency_ms: Optional[float] = None
    detail: Optional[str] = None


class ServerStatsOut(BaseModel):
    collected_at: datetime
    hostname: str
    platform: str
    os_version: str
    architecture: str
    python_version: str
    boot_time: Optional[datetime] = None
    uptime_seconds: Optional[float] = None
    cpu: CpuStats
    memory: MemoryStats
    disks: list[DiskStats] = Field(default_factory=list)
    process: ProcessStats
    services: list[ServiceHealth] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
