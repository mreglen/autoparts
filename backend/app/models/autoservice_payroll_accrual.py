from decimal import Decimal

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class AutoservicePayrollAccrual(Base):
    __tablename__ = "autoservice_payroll_accruals"

    id = Column(Integer, primary_key=True)
    organization_id = Column(
        String(10),
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )
    employee_id = Column(
        Integer,
        ForeignKey("autoservice_service_employees.id", ondelete="CASCADE"),
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
    accrual_type = Column(String(32), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    accrued_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)

    employee = relationship("AutoserviceServiceEmployee", foreign_keys=[employee_id])
    order = relationship("RepairOrder", foreign_keys=[order_id])
