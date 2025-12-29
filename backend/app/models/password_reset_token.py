from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from ..db.database import Base

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    token = Column(String, primary_key=True, index=True)
    email = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())