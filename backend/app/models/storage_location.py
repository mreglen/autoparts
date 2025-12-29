from sqlalchemy import Column, Integer, Text, ForeignKey, String
from sqlalchemy.orm import relationship
from ..db.database import Base

class StorageLocation(Base):
    __tablename__ = "storage_locations"

    id = Column(Integer, primary_key=True, index=True)
    address = Column(Text)

    organization_id = Column(String, ForeignKey("organizations.id"))
    organization = relationship("Organization", back_populates="storage_locations")

    stock_ins = relationship("StockIn", back_populates="storage_location")
    stock_outs = relationship("StockOut", back_populates="storage_location")