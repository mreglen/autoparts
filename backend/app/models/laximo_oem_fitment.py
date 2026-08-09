from __future__ import annotations

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from ..db.database import Base


class LaximoOemArticle(Base):
    """Normalized OEM article — fitment is shared across all products with same oem_norm."""

    __tablename__ = "laximo_oem_articles"

    id = Column(Integer, primary_key=True)
    oem_norm = Column(String(64), nullable=False, unique=True, index=True)
    oem_raw = Column(String(64), nullable=False)
    brand_hint = Column(String(64), nullable=False, default="")
    status = Column(String(32), nullable=False, default="pending")
    vehicle_count = Column(Integer, nullable=False, default=0)
    fetched_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    next_retry_at = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    vehicle_links = relationship(
        "LaximoOemVehicleLink",
        back_populates="article",
        cascade="all, delete-orphan",
    )
    catalog_scans = relationship(
        "LaximoOemCatalogScan",
        back_populates="article",
        cascade="all, delete-orphan",
    )


class LaximoApplicableVehicle(Base):
    """Vehicle row from Laximo FindApplicableVehicles — shared across OEMs."""

    __tablename__ = "laximo_applicable_vehicles"
    __table_args__ = (
        UniqueConstraint("catalog", "vehicle_key", name="uq_laximo_applicable_vehicle"),
    )

    id = Column(Integer, primary_key=True)
    catalog = Column(String(64), nullable=False)
    vehicle_id = Column(String(64), nullable=True)
    vehicle_key = Column(String(128), nullable=False)
    brand = Column(String(80), nullable=True)
    name = Column(String(255), nullable=True)
    year_from = Column(String(8), nullable=True)
    year_to = Column(String(8), nullable=True)
    attributes_json = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    article_links = relationship(
        "LaximoOemVehicleLink",
        back_populates="vehicle",
        cascade="all, delete-orphan",
    )


class LaximoOemVehicleLink(Base):
    """Many-to-many: one OEM article ↔ many vehicles, one vehicle ↔ many OEMs."""

    __tablename__ = "laximo_oem_vehicle_links"
    __table_args__ = (
        UniqueConstraint("article_id", "vehicle_id", name="uq_laximo_oem_vehicle_link"),
    )

    id = Column(Integer, primary_key=True)
    article_id = Column(
        Integer,
        ForeignKey("laximo_oem_articles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    vehicle_id = Column(
        Integer,
        ForeignKey("laximo_applicable_vehicles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    article = relationship("LaximoOemArticle", back_populates="vehicle_links")
    vehicle = relationship("LaximoApplicableVehicle", back_populates="article_links")


class LaximoOemCatalogScan(Base):
    """Catalog scan state per OEM article — enables incremental fetch without re-FPR."""

    __tablename__ = "laximo_oem_catalog_scans"
    __table_args__ = (
        UniqueConstraint("article_id", "catalog_code", name="uq_laximo_oem_catalog_scan"),
    )

    id = Column(Integer, primary_key=True)
    article_id = Column(
        Integer,
        ForeignKey("laximo_oem_articles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    catalog_code = Column(String(64), nullable=False)
    catalog_brand = Column(String(80), nullable=True)
    has_detailapplicability = Column(Boolean, nullable=False, default=False)
    fav_status = Column(String(32), nullable=False, default="pending")
    vehicles_found = Column(Integer, nullable=False, default=0)
    scanned_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    article = relationship("LaximoOemArticle", back_populates="catalog_scans")
