from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from ..db.database import Base

class StorageCell(Base):
    __tablename__ = "storage_cells"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)  # Seller can name it whatever they want
    description = Column(Text)  # Optional description
    
    # Foreign key to storage location (warehouse)
    storage_location_id = Column(Integer, ForeignKey("storage_locations.id"), nullable=False)
    
    # Relationships
    storage_location = relationship("StorageLocation", back_populates="storage_cells")
    product_storage_cells = relationship("ProductStorageCell", back_populates="storage_cell", cascade="all, delete-orphan")

# Relationship for StorageLocation -> StorageCells
from .storage_location import StorageLocation
StorageLocation.storage_cells = relationship("StorageCell", back_populates="storage_location", cascade="all, delete-orphan")