from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.db.database import Base

class PendingSeller(Base):
    __tablename__ = "pending_sellers"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    phone = Column(String)
    created_at = Column(DateTime, default=func.now())
    
    # Personal info
    last_name = Column(String)          
    first_name = Column(String)         
    patronymic = Column(String, nullable=True)  
    
    # Organization info
    name_organization = Column(String)
    description_organization = Column(Text, nullable=True)
    address_organization = Column(String)