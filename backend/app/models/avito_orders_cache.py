from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class AvitoOrderCache(Base):
    __tablename__ = "avito_orders_cache"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(String(10), ForeignKey("organizations.id"), index=True, nullable=False)

    # Avito order ids can exceed JS safe integer range, store as string.
    avito_order_id = Column(String(64), nullable=False, index=True)
    avito_status_code = Column(String(50), nullable=True, index=True)

    avito_data = Column(JSON, nullable=True)

    total_amount = Column(Float, nullable=False, default=0.0)
    is_paid = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    synced_at = Column(DateTime(timezone=True), nullable=True)
    closed_processed = Column(Boolean, nullable=False, server_default="false", default=False)

    organization = relationship("Organization")

