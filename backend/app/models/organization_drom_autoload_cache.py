from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from ..db.database import Base


class OrganizationDromAutoloadCache(Base):
    __tablename__ = "organization_drom_autoload_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    organization_id = Column(String(10), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, unique=True)
    saved_path = Column(String(500), nullable=True)
    items_json = Column(Text, nullable=True)
    local_validation_ok = Column(Boolean, default=False)
    local_errors_json = Column(Text, nullable=True)
    drom_upload_response_json = Column(Text, nullable=True)
    drom_upload_status = Column(Integer, nullable=True)
    drom_token_error = Column(String(500), nullable=True)
    warnings_json = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    organization = relationship("Organization")
