from sqlalchemy import Column, String, Text, BigInteger, DateTime, ForeignKey, func, Boolean
from sqlalchemy.orm import relationship

from ..db.database import Base


class OrganizationAvitoIntegration(Base):
    __tablename__ = "organization_avito_integration"

    organization_id = Column(String(10), ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True)
    avito_user_id = Column(BigInteger, nullable=False)
    client_id = Column(String(255), nullable=False)
    client_secret_encrypted = Column(Text, nullable=False)
    enabled = Column(Boolean, nullable=False, server_default="true", default=True)
    pro_active = Column(Boolean, nullable=False, server_default="true", default=True)
    pro_status_message = Column(Text, nullable=True)
    pro_status_checked_at = Column(DateTime, nullable=True)
    pro_features_json = Column(Text, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    organization = relationship("Organization", back_populates="avito_integration")
