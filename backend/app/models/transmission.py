from sqlalchemy import Column, ForeignKey, Integer, SmallInteger, String
from sqlalchemy.orm import relationship

from ..db.database import Base


class Transmission(Base):
    __tablename__ = "transmissions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(64), nullable=False, unique=True)
    sort_order = Column(SmallInteger, nullable=False, default=0)

    vehicle_links = relationship(
        "VehicleTransmission",
        back_populates="transmission",
    )


class VehicleTransmission(Base):
    """Связь автомобиля с типом КПП из справочника (не более одной на vehicle_id)."""

    __tablename__ = "vehicle_transmissions"

    vehicle_id = Column(
        Integer,
        ForeignKey("vehicles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    transmission_id = Column(
        Integer,
        ForeignKey("transmissions.id", ondelete="RESTRICT"),
        nullable=False,
    )

    vehicle = relationship("Vehicle", back_populates="transmission_assignment")
    transmission = relationship("Transmission", back_populates="vehicle_links")
