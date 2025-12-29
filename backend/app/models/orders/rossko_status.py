from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import relationship
from app.db.database import Base

class RosskoStatus(Base):
    __tablename__ = "rossko_statuses"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(Integer, unique=True, nullable=False)  # Код статуса из API Росско
    name = Column(String(100), nullable=False)  # Название статуса
    description = Column(Text, nullable=True)  # Описание статуса

    # Связи
    # Здесь можно добавить связь с заказами росско если нужно

    def __repr__(self):
        return f"<RosskoStatus(id={self.id}, code={self.code}, name='{self.name}')>"
