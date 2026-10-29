from decimal import Decimal

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class AutoserviceContractorPayout(Base):
    __tablename__ = "autoservice_contractor_payouts"

    id = Column(Integer, primary_key=True)
    organization_id = Column(
        String(10),
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )
    contractor_id = Column(
        Integer,
        ForeignKey("autoservice_contractors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order_id = Column(
        Integer,
        ForeignKey("repair_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    work_id = Column(
        Integer,
        ForeignKey("repair_order_works.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    work_title = Column(String(255), nullable=True)
    accrual_type = Column(String(32), nullable=False, default="contractor_fixed")
    amount = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    accrued_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)

    contractor = relationship("AutoserviceContractor", foreign_keys=[contractor_id])
    order = relationship("RepairOrder", foreign_keys=[order_id])
