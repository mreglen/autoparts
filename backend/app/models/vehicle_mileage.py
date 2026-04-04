from sqlalchemy import BigInteger, Column, ForeignKey, Integer
from sqlalchemy.orm import relationship
from ..db.database import Base


class VehicleMileage(Base):
    __tablename__ = "vehicle_mileages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id", ondelete="CASCADE"), unique=True, nullable=False)
    mileage = Column(BigInteger, nullable=False)

    vehicle = relationship("Vehicle", back_populates="mileage_row")
