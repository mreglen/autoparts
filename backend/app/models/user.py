from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from ..db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    public_code = Column(String(10), unique=True, nullable=False, index=True)
    last_name = Column(String(100))          
    first_name = Column(String(100))         
    patronymic = Column(String(100), nullable=True)  
    email = Column(String(255), unique=True, index=True)
    phone = Column(String(20))
    is_buyer = Column(Boolean, default=False)
    is_seller = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    is_director = Column(Boolean, default=False)
    is_employee = Column(Boolean, default=False)
    hashed_password = Column(String)
    avatar_url = Column(String(512), nullable=True)
    notify_push_enabled = Column(Boolean, default=True, nullable=False)
    notify_email_enabled = Column(Boolean, default=True, nullable=False)

    organization_id = Column(String(10), ForeignKey("organizations.id"))

    # Связи
    organization = relationship("Organization", back_populates="users")
    carts = relationship("Cart", back_populates="user")
    sessions = relationship("UserSession", back_populates="user")
    user_permissions = relationship("UserPermission", back_populates="user")

