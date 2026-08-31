from sqlalchemy import Column, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class GarageVehicleMileageHistory(Base):
    __tablename__ = "garage_vehicle_mileage_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    garage_vehicle_id = Column(
        Integer,
        ForeignKey("garage_vehicles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    mileage_km = Column(Integer, nullable=False)
    repair_order_id = Column(
        Integer,
        ForeignKey("repair_orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    recorded_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    recorded_at = Column(DateTime, server_default=func.now(), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    vehicle = relationship("GarageVehicle", back_populates="mileage_history", foreign_keys=[garage_vehicle_id])
    repair_order = relationship("RepairOrder", foreign_keys=[repair_order_id])
    recorded_by = relationship("User", foreign_keys=[recorded_by_user_id])
