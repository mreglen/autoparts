from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ...db.database import Base

class NewPartsCart(Base):
    __tablename__ = "new_parts_cart"

    id = Column(Integer, primary_key=True, index=True)
    cart_id = Column(Integer, ForeignKey("carts.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Поля для новых запчастей
    brand = Column(String(100), nullable=False)
    partnumber = Column(String(100), nullable=False)
    name = Column(String(255), nullable=True)  # Название запчасти
    delivery = Column(String(255), nullable=True)
    quantity = Column(Integer, nullable=False, default=1)
    max_quantity = Column(Integer, nullable=True)
    price = Column(Numeric(12, 2), nullable=False)
    stock_id = Column(String(50), nullable=False)  # ID склада из Rossmann API

    # Дополнительные поля для совместимости
    guid = Column(String(50), nullable=True)
    delivery_start = Column(DateTime, nullable=True)
    delivery_end = Column(DateTime, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Отношения
    cart = relationship("Cart", back_populates="new_parts_items")
    user = relationship("User")

    @property
    def seller(self):
        return "Новые запчасти"
