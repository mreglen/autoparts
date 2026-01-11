from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ...db.database import Base

class Cart(Base):
    __tablename__ = "carts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Отношения
    user = relationship("User", back_populates="carts")

    # Новые отношения для разделения типов товаров
    new_parts_items = relationship("NewPartsCart", back_populates="cart", cascade="all, delete-orphan")
    used_parts_items = relationship("UsedPartsCart", back_populates="cart", cascade="all, delete-orphan")