from sqlalchemy import Column, Integer, ForeignKey, String
from sqlalchemy.orm import relationship
from ..db.database import Base

class ProductStorageCell(Base):
    __tablename__ = "product_storage_cells"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign keys
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    storage_cell_id = Column(Integer, ForeignKey("storage_cells.id"), nullable=False)
    
    # Value stored in this cell for this product
    value = Column(String(255))
    
    # Relationships
    product = relationship("Product", back_populates="product_storage_cells")
    storage_cell = relationship("StorageCell", back_populates="product_storage_cells")

# Relationship for Product -> ProductStorageCells
from .product import Product
Product.product_storage_cells = relationship("ProductStorageCell", back_populates="product", cascade="all, delete-orphan")