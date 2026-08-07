from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class RepairBooking(Base):
    """Client request for a repair slot; staff turns it into a repair order."""

    __tablename__ = "repair_bookings"

    id = Column(Integer, primary_key=True)
    organization_id = Column(String(10), ForeignKey("organizations.id"), nullable=False, index=True)
    client_id = Column(
        Integer,
        ForeignKey("autoservice_clients.id"),
        nullable=True,
        index=True,
    )
    garage_vehicle_id = Column(
        Integer,
        ForeignKey("garage_vehicles.id"),
        nullable=True,
        index=True,
    )
    name = Column(String(120), nullable=False)
    phone = Column(String(32), nullable=False)
    preferred_date = Column(Date, nullable=False, index=True)
    comment = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="new", index=True)
    source = Column(String(32), nullable=False, default="client")
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    staff_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    organization = relationship("Organization", foreign_keys=[organization_id])
    client = relationship("AutoserviceClient", foreign_keys=[client_id])
    vehicle = relationship("GarageVehicle", foreign_keys=[garage_vehicle_id])
    created_by = relationship("User", foreign_keys=[created_by_user_id])
