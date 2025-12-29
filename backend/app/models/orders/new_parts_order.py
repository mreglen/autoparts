from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base

class NewPartsOrder(Base):
    __tablename__ = "new_parts_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)

    # Специфические поля для новых запчастей
    seller = Column(String(100), nullable=False)  # Продавец/организация
    deliver_in_parts = Column(Boolean, default=False)  # Доставка частями

    # Связи
    order = relationship("Order", back_populates="new_parts_order")

    def __repr__(self):
        return f"<NewPartsOrder(id={self.id}, order_id={self.order_id}, seller='{self.seller}')>"
