from decimal import Decimal

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class AutoservicePayment(Base):
    __tablename__ = "autoservice_payments"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "sequential_number",
            name="uq_autoservice_payments_org_seq",
        ),
    )

    id = Column(Integer, primary_key=True)
    organization_id = Column(
        String(10),
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )
    repair_order_id = Column(
        Integer,
        ForeignKey("repair_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sequential_number = Column(Integer, nullable=False)
    method = Column(String(16), nullable=False)  # card | cash | bank
    amount = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    created_by_user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)

    order = relationship("RepairOrder", foreign_keys=[repair_order_id])
    created_by = relationship("User", foreign_keys=[created_by_user_id])
