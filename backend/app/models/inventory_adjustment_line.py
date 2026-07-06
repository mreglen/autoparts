from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from ..db.database import Base


class InventoryAdjustmentLine(Base):
    __tablename__ = "inventory_adjustment_lines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("inventory_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    storage_location_id = Column(Integer, ForeignKey("storage_locations.id"), nullable=False)
    expected_qty = Column(Integer, nullable=False, default=0)
    counted_qty = Column(Integer, nullable=False, default=0)
    delta_qty = Column(Integer, nullable=False, default=0)
    adjustment_kind = Column(String(32), nullable=False)
    stock_in_id = Column(Integer, ForeignKey("stock_in.id"), nullable=True)
    stock_out_id = Column(Integer, ForeignKey("stock_out.id"), nullable=True)
    applied_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    session = relationship("InventorySession", back_populates="adjustment_lines")
    product = relationship("Product")
    stock_in = relationship("StockIn")
    stock_out = relationship("StockOut")
