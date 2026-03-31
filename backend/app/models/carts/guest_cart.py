from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ...db.database import Base


class GuestCart(Base):
    __tablename__ = "guest_carts"

    id = Column(Integer, primary_key=True, index=True)
    token_hash = Column(String(128), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    new_parts_items = relationship("GuestNewPartsCart", back_populates="guest_cart", cascade="all, delete-orphan")
    used_parts_items = relationship("GuestUsedPartsCart", back_populates="guest_cart", cascade="all, delete-orphan")
