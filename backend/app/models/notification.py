from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.sql import func
from app.db.database import Base
from sqlalchemy.orm import relationship


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    endpoint = Column(Text, nullable=False)  # Push service URL
    p256dh = Column(String, nullable=False)  # Client public key
    auth = Column(String, nullable=False)    # Auth secret
    user_agent = Column(String(500))         # Browser/device info
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used = Column(DateTime(timezone=True))
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
