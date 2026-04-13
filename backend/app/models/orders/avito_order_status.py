from sqlalchemy import Column, Integer, String, Text
from app.db.database import Base


class AvitoOrderStatus(Base):
    """Статусы заказов Авито"""
    __tablename__ = "avito_order_statuses"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    def __repr__(self):
        return f"<AvitoOrderStatus(code='{self.code}', name='{self.name}')>"
