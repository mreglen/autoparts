from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from ..db.database import Base


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, index=True, nullable=False)  # e.g., "orders.view"
    name = Column(String(255), nullable=False)  # Human-readable name for the permission

    user_permissions = relationship("UserPermission", back_populates="permission")