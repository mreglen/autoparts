from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..db.database import Base


class PrinterAgent(Base):
    """
    “ПК <-> агент” связь.
    Дает агенту токен для подключения по WebSocket и связывает его с организацией.
    """

    __tablename__ = "printer_agents"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(String(10), ForeignKey("organizations.id"), nullable=False, index=True)

    # Токен для подключения агента к серверу печати
    printer_token = Column(String(64), nullable=False, unique=True, index=True)

    # Кто сгенерировал/управляет подключением (директор)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    hostname = Column(String(255), nullable=True)
    device_info = Column(String(255), nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)
    last_seen = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Optional relationships
    organization = relationship("Organization")
    created_by_user = relationship("User")

