from __future__ import annotations

from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy import JSON

from ..db.database import Base


class LaximoSnapshot(Base):
    """Durable cache-on-read snapshot of a Laximo CAT response (no live ssd in key)."""

    __tablename__ = "laximo_snapshots"
    __table_args__ = (
        UniqueConstraint("kind", "resource_key", name="uq_laximo_snapshots_kind_key"),
    )

    id = Column(Integer, primary_key=True)
    kind = Column(String(64), nullable=False, index=True)
    resource_key = Column(String(512), nullable=False)
    catalog = Column(String(64), nullable=True, index=True)
    vehicle_id = Column(String(64), nullable=True, index=True)
    vin = Column(String(17), nullable=True, index=True)
    payload = Column(JSON, nullable=False)
    payload_version = Column(Integer, nullable=False, default=1)
    source = Column(String(32), nullable=False, default="live")
    fetched_at = Column(DateTime, nullable=False, server_default=func.now())
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class LaximoSnapshotAsset(Base):
    """Local copy of a Laximo unit/schema image for offline browse."""

    __tablename__ = "laximo_snapshot_assets"

    id = Column(Integer, primary_key=True)
    url_hash = Column(String(64), nullable=False, unique=True, index=True)
    source_url = Column(Text, nullable=False)
    local_path = Column(String(512), nullable=False)
    content_type = Column(String(128), nullable=True)
    bytes = Column(Integer, nullable=True)
    fetched_at = Column(DateTime, nullable=False, server_default=func.now())
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
