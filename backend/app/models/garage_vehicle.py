from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class GarageVehicle(Base):
    __tablename__ = "garage_vehicles"
    __table_args__ = (
        UniqueConstraint("client_id", "vin", name="uq_garage_vehicles_client_vin"),
    )

    id = Column(Integer, primary_key=True)
    client_id = Column(
        Integer,
        ForeignKey("autoservice_clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    organization_id = Column(String(10), ForeignKey("organizations.id"), nullable=False, index=True)
    vin = Column(String(17), nullable=True)
    make = Column(String(80), nullable=False)
    model = Column(String(80), nullable=False)
    year = Column(Integer, nullable=True)
    color = Column(String(40), nullable=True)
    plate = Column(String(20), nullable=True)
    notes = Column(Text, nullable=True)
    source = Column(String(32), nullable=False, default="manual")
    laximo_catalog = Column(String(64), nullable=True)
    laximo_vehicle_id = Column(String(64), nullable=True)
    laximo_attributes = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    client = relationship("AutoserviceClient", foreign_keys=[client_id])
    organization = relationship("Organization", foreign_keys=[organization_id])
