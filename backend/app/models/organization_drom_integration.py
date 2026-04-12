from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from ..db.database import Base


class OrganizationDromIntegration(Base):
    __tablename__ = "organization_drom_integration"

    organization_id = Column(String(10), ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True)
    is_enabled = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    organization = relationship("Organization", back_populates="drom_integration")
