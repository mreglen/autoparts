from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class GarageNewOrder(Base):
    __tablename__ = "garage_new_orders"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(String(10), ForeignKey("organizations.id"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)

    buyer_name = Column(String(255), nullable=False, default="")
    buyer_phone = Column(String(50), nullable=False, default="")
    buyer_email = Column(String(255), nullable=False, default="")

    delivery_type = Column(String(50), nullable=False, default="transport")
    delivery_address = Column(Text, nullable=True)
    transport_company = Column(String(255), nullable=True)
    pickup_address = Column(Text, nullable=True)
    delivery_region_id = Column(Integer, nullable=True)
    delivery_region_name = Column(String(255), nullable=True)

    total_amount = Column(Float, nullable=False, default=0.0)
    is_paid = Column(Boolean, nullable=False, default=False)
    status_code = Column(String(50), nullable=False, default="new_waiting_confirmation", index=True)

    pickup_code_hash = Column(String(64), nullable=True)
    pickup_code_cipher = Column(Text, nullable=True)
    pickup_code_created_at = Column(DateTime(timezone=True), nullable=True)
    pickup_code_expires_at = Column(DateTime(timezone=True), nullable=True)
    pickup_verified_at = Column(DateTime(timezone=True), nullable=True)
    pickup_verify_attempts = Column(Integer, nullable=False, default=0)

    seller = Column(String(255), nullable=True)
    deliver_in_parts = Column(Boolean, nullable=False, default=False)
    rossko_order_id = Column(String(64), nullable=True, index=True)
    rossko_response_raw = Column(Text, nullable=True)
    checkout_session_id = Column(String(36), nullable=True, index=True)
    yookassa_payment_id = Column(String(64), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    items = relationship(
        "GarageNewOrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class GarageNewOrderItem(Base):
    __tablename__ = "garage_new_order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("garage_new_orders.id", ondelete="CASCADE"), index=True, nullable=False)

    name = Column(String(255), nullable=False, default="")
    brand = Column(String(100), nullable=True)
    partnumber = Column(String(100), nullable=True)
    quantity = Column(Integer, nullable=False, default=1)
    price = Column(Float, nullable=False, default=0.0)
    supplier_unit_price = Column(Float, nullable=True)
    status_code = Column(String(50), nullable=False, default="new_waiting_confirmation", index=True)
    seo_card_id = Column(Integer, ForeignKey("new_parts_seo_cards.id"), nullable=True, index=True)

    order = relationship("GarageNewOrder", back_populates="items")

