from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.db.database import Base


class EventLog(Base):
    __tablename__ = "event_log"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(50), nullable=False)  
    user_id = Column(Integer, nullable=True)         
    email = Column(String, nullable=True)
    details = Column(Text, nullable=True)            
    created_at = Column(DateTime(timezone=True), server_default=func.now())