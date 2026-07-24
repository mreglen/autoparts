from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class SitePayment(Base):
    __tablename__ = "site_payments"

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    duration_days = Column(Integer, nullable=False)
    monthly_amount = Column(Numeric(12, 2), nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    amount_paid = Column(Numeric(12, 2), nullable=False, default=0)
    comment = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="active")
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    created_by = relationship("User", foreign_keys=[created_by_id])
    ledger_entries = relationship(
        "SitePaymentLedger",
        back_populates="payment",
        cascade="all, delete-orphan",
        order_by="SitePaymentLedger.created_at.desc()",
    )


class SitePaymentLedger(Base):
    __tablename__ = "site_payment_ledger"

    id = Column(Integer, primary_key=True)
    payment_id = Column(Integer, ForeignKey("site_payments.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    note = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    payment = relationship("SitePayment", back_populates="ledger_entries")
    created_by = relationship("User", foreign_keys=[created_by_id])
