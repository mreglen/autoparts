from sqlalchemy import Column, String, Text, BigInteger, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from ..db.database import Base


class OrganizationAvitoIntegration(Base):
    __tablename__ = "organization_avito_integration"

    organization_id = Column(String(10), ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True)
    avito_user_id = Column(BigInteger, nullable=False)
    client_id = Column(String(255), nullable=False)
    client_secret_encrypted = Column(Text, nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    organization = relationship("Organization", back_populates="avito_integration")
