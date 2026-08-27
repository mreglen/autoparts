from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class YookassaPayment(Base):
    __tablename__ = "yookassa_payments"

    id = Column(String(36), primary_key=True)
    idempotence_key = Column(String(36), unique=True, nullable=False, index=True)
    session_id = Column(
        String(36),
        ForeignKey("new_parts_checkout_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    yookassa_payment_id = Column(String(64), unique=True, nullable=True, index=True)
    payment_method_type = Column(String(32), nullable=False)
    status = Column(String(32), nullable=False, default="pending", index=True)
    amount_value = Column(Float, nullable=False, default=0.0)
    amount_currency = Column(String(3), nullable=False, default="RUB")
    paid_at = Column(DateTime(timezone=True), nullable=True)
    description = Column(String(255), nullable=True)
    confirmation_type = Column(String(32), nullable=True)
    confirmation_url = Column(Text, nullable=True)
    qr_payload = Column(Text, nullable=True)
    receipt_snapshot = Column(Text, nullable=True)
    payment_metadata = Column(Text, nullable=True)
    raw_create_response = Column(Text, nullable=True)
    raw_webhook_payload = Column(Text, nullable=True)
    captured = Column(Boolean, nullable=True)
    refundable = Column(Boolean, nullable=True)
    refund_id = Column(String(64), nullable=True, index=True)
    refund_status = Column(String(32), nullable=True, index=True)
    income_amount = Column(Float, nullable=True)
    acquiring_fee_amount = Column(Float, nullable=True)
    refund_amount = Column(Float, nullable=True)
    refunded_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    session = relationship(
        "NewPartsCheckoutSession",
        back_populates="payments",
        foreign_keys=[session_id],
    )
