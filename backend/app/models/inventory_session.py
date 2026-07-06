from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from ..db.database import Base


class InventorySession(Base):
    __tablename__ = "inventory_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    organization_id = Column(String(10), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    storage_location_id = Column(Integer, ForeignKey("storage_locations.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="draft", server_default="draft")
    scope_type = Column(String(32), nullable=False, default="location_all", server_default="location_all")
    scope_cell_ids_json = Column(Text, nullable=True)
    scope_product_ids_json = Column(Text, nullable=True)
    title = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    completed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    organization = relationship("Organization")
    storage_location = relationship("StorageLocation")
    creator = relationship("User", foreign_keys=[created_by])
    completer = relationship("User", foreign_keys=[completed_by])
    count_lines = relationship(
        "InventoryCountLine",
        back_populates="session",
        cascade="all, delete-orphan",
    )
    adjustment_lines = relationship(
        "InventoryAdjustmentLine",
        back_populates="session",
        cascade="all, delete-orphan",
    )
