from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func

from app.db.database import Base

class PendingUser(Base):
    __tablename__ = "pending_users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    verification_code = Column(String)
    created_at = Column(DateTime, default=func.now())
    is_verified = Column(Boolean, default=False) 


    last_name = Column(String, nullable=True)
    first_name = Column(String, nullable=True)
    patronymic = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    is_buyer = Column(Boolean, default=False, nullable=True)
    is_seller = Column(Boolean, default=False, nullable=True)
    name_organization = Column(String, nullable=True)
    address_organization = Column(String, nullable=True)
    hashed_password = Column(String, nullable=True)