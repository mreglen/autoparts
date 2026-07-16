"""Persistent mapping for warehouse label QR: pending_id ↔ product_id ↔ internal_code.

Printed QR uses stable /qr/label/{internal_code}. Legacy stickers with
/my-parts/edit-pending/{pending_id} resolve via this table after approval.
"""
from sqlalchemy import Column, Integer, String, DateTime, Index, text
from sqlalchemy.sql import func

from app.db.database import Base


class LabelQrLink(Base):
    __tablename__ = "label_qr_links"
    __table_args__ = (
        Index("ix_label_qr_links_internal_code", "internal_code"),
        Index("ix_label_qr_links_product_id", "product_id"),
        Index("ix_label_qr_links_organization_id", "organization_id"),
        Index(
            "uq_label_qr_links_pending_product_id",
            "pending_product_id",
            unique=True,
            postgresql_where=text("pending_product_id IS NOT NULL"),
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(String(10), nullable=False)
    internal_code = Column(String(64), nullable=False)
    pending_product_id = Column(Integer, nullable=True)
    product_id = Column(Integer, nullable=True)
    rejected_product_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
