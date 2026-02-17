from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship
from ..db.database import Base


class UserPermission(Base):
    __tablename__ = "user_permissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Links to users table
    permission_id = Column(Integer, ForeignKey("permissions.id"), nullable=False)  # Links to permissions table

    user = relationship("User", back_populates="user_permissions")
    permission = relationship("Permission", back_populates="user_permissions")