from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, SmallInteger, String, Text
from sqlalchemy.orm import relationship

from ..db.database import Base


class StorageLocation(Base):
    __tablename__ = "storage_locations"

    id = Column(Integer, primary_key=True, index=True)
    address = Column(Text)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    geocoded_at = Column(DateTime, nullable=True)
    geocode_qc = Column(SmallInteger, nullable=True)

    organization_id = Column(String, ForeignKey("organizations.id"))
    organization = relationship("Organization", back_populates="storage_locations")

    stock_ins = relationship("StockIn", back_populates="storage_location")
    stock_outs = relationship("StockOut", back_populates="storage_location")
