from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ...db.database import Base


class GuestNewPartsCart(Base):
    __tablename__ = "guest_new_parts_cart"

    id = Column(Integer, primary_key=True, index=True)
    guest_cart_id = Column(Integer, ForeignKey("guest_carts.id"), nullable=False, index=True)
    brand = Column(String(100), nullable=False)
    partnumber = Column(String(100), nullable=False)
    name = Column(String(255), nullable=True)
    delivery = Column(String(255), nullable=True)
    quantity = Column(Integer, nullable=False, default=1)
    price = Column(Numeric(12, 2), nullable=False)
    stock_id = Column(String(50), nullable=False, index=True)
    guid = Column(String(50), nullable=True)
    delivery_start = Column(DateTime, nullable=True)
    delivery_end = Column(DateTime, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    guest_cart = relationship("GuestCart", back_populates="new_parts_items")

    @property
    def seller(self):
        return "Новые запчасти"
