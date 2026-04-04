from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from ..db.database import Base


class VehicleVin(Base):
    __tablename__ = "vehicle_vins"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id", ondelete="CASCADE"), unique=True, nullable=False)
    vin = Column(String(17), nullable=False)

    vehicle = relationship("Vehicle", back_populates="vin_row")
