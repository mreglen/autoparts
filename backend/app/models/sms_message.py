from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text, func

from app.db.database import Base


class SmsMessage(Base):
    __tablename__ = "sms_messages"

    id = Column(Integer, primary_key=True)
    organization_id = Column(String(10), nullable=True, index=True)
    inspection_booking_id = Column(Integer, nullable=True, index=True)
    phone = Column(String(40), nullable=False)
    text = Column(Text, nullable=False)
    provider = Column(String(16), nullable=False, default="smsgold")
    status = Column(String(16), nullable=False, default="sent", index=True)
    cost = Column(Numeric(12, 4), nullable=True)
    error_message = Column(Text, nullable=True)
    provider_message_id = Column(String(64), nullable=True)
    created_by_user_id = Column(Integer, nullable=True, index=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)
