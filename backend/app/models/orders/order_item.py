from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)

    # Информация о товаре
    name = Column(String(200), nullable=False)  # Название запчасти
    brand = Column(String(100), nullable=False)  # Бренд
    partnumber = Column(String(50), nullable=False)  # Номер запчасти
    quantity = Column(Integer, nullable=False)  # Количество
    price = Column(Float, nullable=False)  # Цена за единицу

    # Статус элемента заказа
    status_id = Column(Integer, ForeignKey("order_item_statuses.id"), nullable=False)

    # Связи
    order = relationship("Order", back_populates="items")
    status = relationship("OrderItemStatus", back_populates="order_items")

    def __repr__(self):
        return f"<OrderItem(id={self.id}, order_id={self.order_id}, brand='{self.brand}', partnumber='{self.partnumber}')>"
