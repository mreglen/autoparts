from sqlalchemy import Column, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import relationship
from ..db.database import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    brand = Column(String(50), nullable=False)
    model = Column(String(100), nullable=False)
    generation = Column(String(50))
    engine = Column(String(50))
    transmission = Column(String(30))
    description = Column(Text, nullable=True)
    organization_id = Column(String, ForeignKey("organizations.id"))
    storage_location_id = Column(Integer, ForeignKey("storage_locations.id"), nullable=True)

    tecdoc_manufacturer_id = Column(Integer, nullable=True)
    tecdoc_model_id = Column(Integer, nullable=True)
    tecdoc_passengercar_id = Column(Integer, nullable=True)
    tecdoc_engine_id = Column(Integer, nullable=True)

    price = Column(Numeric(12, 2), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    tecdoc_manufacturer_json = Column(JSONB, nullable=True)
    tecdoc_model_json = Column(JSONB, nullable=True)
    tecdoc_passengercar_json = Column(JSONB, nullable=True)
    tecdoc_engine_json = Column(JSONB, nullable=True)
    tecdoc_transmission_json = Column(JSONB, nullable=True)

    organization = relationship("Organization")
    storage_location = relationship("StorageLocation")
    creator = relationship("User", foreign_keys=[created_by])

    photos = relationship(
        "VehiclePhoto",
        back_populates="vehicle",
        cascade="all, delete-orphan",
        order_by="VehiclePhoto.sort_order",
    )

    compatible_products = relationship(
        "Product",
        secondary="product_vehicle_association",
        back_populates="compatible_vehicles",
    )

    vin_row = relationship(
        "VehicleVin",
        back_populates="vehicle",
        uselist=False,
        cascade="all, delete-orphan",
    )
    mileage_row = relationship(
        "VehicleMileage",
        back_populates="vehicle",
        uselist=False,
        cascade="all, delete-orphan",
    )
    transmission_assignment = relationship(
        "VehicleTransmission",
        back_populates="vehicle",
        uselist=False,
        cascade="all, delete-orphan",
    )

    @property
    def transmission_id(self):
        link = self.transmission_assignment
        return link.transmission_id if link is not None else None

    @hybrid_property
    def vin(self):
        vr = self.vin_row
        return vr.vin if vr else None

    @hybrid_property
    def mileage(self):
        mr = self.mileage_row
        return mr.mileage if mr else None
