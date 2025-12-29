from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base

class UsedPartsOrder(Base):
    __tablename__ = "used_parts_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)

    # Заглушка для будущей реализации
    # Здесь будут специфические поля для б/у запчастей

    # Связи
    order = relationship("Order", back_populates="used_parts_order")

    def __repr__(self):
        return f"<UsedPartsOrder(id={self.id}, order_id={self.order_id})>"
