from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, false, func, text

from app.db.database import Base


class RosskoSettings(Base):
    """Глобальные настройки оформления заказов Rossko (одна строка id=1)."""

    __tablename__ = "rossko_settings"

    id = Column(Integer, primary_key=True)
    delivery_id = Column(String(64), nullable=True)
    address_id = Column(String(64), nullable=True)
    payment_id = Column(Integer, nullable=True)
    requisite_id = Column(Integer, nullable=True)
    contact_name = Column(String(255), nullable=False, default="", server_default=text("''"))
    contact_phone = Column(String(50), nullable=False, default="", server_default=text("''"))
    default_comment = Column(Text, nullable=True)
    delivery_parts = Column(Boolean, nullable=False, default=False, server_default=false())
    delivery_name = Column(String(255), nullable=True)
    address_label = Column(String(512), nullable=True)
    payment_name = Column(String(255), nullable=True)
    requisite_name = Column(String(255), nullable=True)
    is_pickup = Column(Boolean, nullable=True)
    requires_address = Column(Boolean, nullable=True)
    requires_requisite = Column(Boolean, nullable=True)
    key1_encrypted = Column(Text, nullable=True)
    key2_encrypted = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
