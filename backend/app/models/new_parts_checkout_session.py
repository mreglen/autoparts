from __future__ import annotations

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class NewPartsCheckoutSession(Base):
    __tablename__ = "new_parts_checkout_sessions"

    id = Column(String(36), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    status = Column(String(32), nullable=False, default="awaiting_payment", index=True)
    amount = Column(Float, nullable=False, default=0.0)
    currency = Column(String(3), nullable=False, default="RUB")
    order_payload = Column(Text, nullable=False, default="{}")
    cart_snapshot = Column(Text, nullable=False, default="[]")
    garage_order_id = Column(Integer, ForeignKey("garage_new_orders.id"), nullable=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    payments = relationship(
        "YookassaPayment",
        back_populates="session",
        foreign_keys="YookassaPayment.session_id",
    )
