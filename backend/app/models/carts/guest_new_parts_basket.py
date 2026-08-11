from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ...db.database import Base
from .new_parts_basket import DEFAULT_NEW_PARTS_BASKET_NAME

__all__ = ["GuestNewPartsBasket", "DEFAULT_NEW_PARTS_BASKET_NAME"]


class GuestNewPartsBasket(Base):
    __tablename__ = "guest_new_parts_baskets"

    id = Column(Integer, primary_key=True, index=True)
    guest_cart_id = Column(Integer, ForeignKey("guest_carts.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    is_default = Column(Boolean, nullable=False, default=False)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    guest_cart = relationship("GuestCart", back_populates="new_parts_baskets")
    items = relationship("GuestNewPartsCart", back_populates="basket")
