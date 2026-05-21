from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.db.database import Base


class EventLog(Base):
    __tablename__ = "event_log"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(50), nullable=False, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    email = Column(String, nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    organization_id = Column(String(10), nullable=True, index=True)
    category = Column(String(50), nullable=True, index=True)
    summary = Column(String(500), nullable=True)
    actor_name = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=True)
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(String(64), nullable=True)
