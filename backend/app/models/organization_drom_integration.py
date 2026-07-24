from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, ForeignKey, func
from sqlalchemy.orm import relationship

from ..db.database import Base


class OrganizationDromIntegration(Base):
    __tablename__ = "organization_drom_integration"

    organization_id = Column(String(10), ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True)
    is_enabled = Column(Boolean, default=False, nullable=False)
    packet_id = Column(String(64), nullable=True)
    api_key_encrypted = Column(Text, nullable=True)
    auto_sync_enabled = Column(Boolean, default=True, nullable=False)
    last_sync_at = Column(DateTime, nullable=True)
    last_sync_status = Column(Integer, nullable=True)
    last_sync_error = Column(String(1000), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    organization = relationship("Organization", back_populates="drom_integration")
