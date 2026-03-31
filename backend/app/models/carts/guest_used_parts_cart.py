from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ...db.database import Base


class GuestUsedPartsCart(Base):
    __tablename__ = "guest_used_parts_cart"

    id = Column(Integer, primary_key=True, index=True)
    guest_cart_id = Column(Integer, ForeignKey("guest_carts.id"), nullable=False, index=True)
    brand = Column(String(100), nullable=True)
    partnumber = Column(String(100), nullable=True)
    delivery = Column(String(255), nullable=True)
    quantity = Column(Integer, nullable=False, default=1)
    price = Column(Numeric(12, 2), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    guest_cart = relationship("GuestCart", back_populates="used_parts_items")
    product = relationship("Product")

    @property
    def seller(self):
        if self.product and self.product.organization:
            return self.product.organization.name
        return "Б/У запчасти"
