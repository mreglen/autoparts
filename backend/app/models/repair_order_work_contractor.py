from decimal import Decimal

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class RepairOrderWorkContractor(Base):
    __tablename__ = "repair_order_work_contractors"
    __table_args__ = (
        UniqueConstraint("work_id", "contractor_id", name="uq_repair_order_work_contractors"),
    )

    id = Column(Integer, primary_key=True)
    work_id = Column(
        Integer,
        ForeignKey("repair_order_works.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    contractor_id = Column(
        Integer,
        ForeignKey("autoservice_contractors.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    amount = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    contractor = relationship("AutoserviceContractor", foreign_keys=[contractor_id])
