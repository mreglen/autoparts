from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.database import Base

class OrderStatus(Base):
    __tablename__ = "order_statuses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)  # Название статуса
    code = Column(String(20), unique=True, nullable=False)  # Код статуса для API

    # Связи
    orders = relationship("Order", back_populates="status")

    def __repr__(self):
        return f"<OrderStatus(id={self.id}, name='{self.name}', code='{self.code}')>"
