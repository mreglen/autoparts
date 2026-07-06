from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class OrderReturnRequest(Base):
    __tablename__ = "order_return_requests"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(String(10), ForeignKey("organizations.id"), index=True, nullable=False)
    order_id = Column(Integer, ForeignKey("garage_used_orders.id"), index=True, nullable=False)
    buyer_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    reason = Column(String(50), nullable=False)
    comment = Column(Text, nullable=True)
    status_code = Column(String(50), nullable=False, default="requested", index=True)
    seller_note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    status_changed_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    attachments = relationship(
        "OrderReturnAttachment",
        back_populates="return_request",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class OrderReturnAttachment(Base):
    __tablename__ = "order_return_attachments"

    id = Column(Integer, primary_key=True, index=True)
    return_request_id = Column(
        Integer,
        ForeignKey("order_return_requests.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    file_url = Column(String(512), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    return_request = relationship("OrderReturnRequest", back_populates="attachments")
