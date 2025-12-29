from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ...db.database import Base

class UsedPartsCart(Base):
    __tablename__ = "used_parts_cart"

    id = Column(Integer, primary_key=True, index=True)
    cart_id = Column(Integer, ForeignKey("carts.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Поля для б/у запчастей (пока заглушка)
    brand = Column(String(100), nullable=True)
    partnumber = Column(String(100), nullable=True)
    delivery = Column(String(255), nullable=True)
    quantity = Column(Integer, nullable=False, default=1)
    price = Column(Numeric(12, 2), nullable=True)

    # Ссылка на продукт из локальной базы
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Отношения
    cart = relationship("Cart", back_populates="used_parts_items")
    user = relationship("User")
    product = relationship("Product")

    @property
    def seller(self):
        return "Б/У запчасти"
