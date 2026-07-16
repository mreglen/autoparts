from sqlalchemy import Column, Integer, ForeignKey, String
from sqlalchemy.orm import relationship
from ..db.database import Base


class PendingProductStorageCell(Base):
    __tablename__ = "pending_product_storage_cells"

    id = Column(Integer, primary_key=True, index=True)

    # Foreign keys
    pending_product_id = Column(Integer, ForeignKey("pending_products.id"), nullable=False)
    storage_cell_id = Column(Integer, ForeignKey("storage_cells.id"), nullable=False)

    # Value stored in this cell for this pending product
    value = Column(String(255))

    # Relationships
    pending_product = relationship("PendingProduct", back_populates="pending_product_storage_cells")
    storage_cell = relationship("StorageCell", back_populates="pending_product_storage_cells")
