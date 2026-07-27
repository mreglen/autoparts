from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class AutoserviceClient(Base):
    __tablename__ = "autoservice_clients"
    __table_args__ = (
        UniqueConstraint("organization_id", "phone", name="uq_autoservice_clients_org_phone"),
    )

    id = Column(Integer, primary_key=True)
    organization_id = Column(String(10), ForeignKey("organizations.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String(120), nullable=False)
    phone = Column(String(32), nullable=False)
    status = Column(String(32), nullable=False, default="active")
    source = Column(String(32), nullable=False)
    consented_at = Column(DateTime, nullable=False)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    organization = relationship("Organization", foreign_keys=[organization_id])
    user = relationship("User", foreign_keys=[user_id])
    created_by = relationship("User", foreign_keys=[created_by_user_id])
