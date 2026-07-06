from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from ..db.database import Base


class InventoryCountLine(Base):
    __tablename__ = "inventory_count_lines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("inventory_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    storage_location_id = Column(Integer, ForeignKey("storage_locations.id"), nullable=False)
    storage_cell_id = Column(Integer, ForeignKey("storage_cells.id"), nullable=True)
    expected_qty = Column(Integer, nullable=False, default=0)
    counted_qty = Column(Integer, nullable=True)
    line_status = Column(String(32), nullable=False, default="pending", server_default="pending")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    session = relationship("InventorySession", back_populates="count_lines")
    product = relationship("Product")
    storage_location = relationship("StorageLocation")
    storage_cell = relationship("StorageCell")
