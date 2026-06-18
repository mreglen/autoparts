from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func

from ..db.database import Base


class OrganizationAiDescriptionAccess(Base):
    __tablename__ = "organization_ai_description_access"

    organization_id = Column(
        String(10),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    is_enabled = Column(Boolean, nullable=False, default=True)
    enabled_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    enabled_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(String(255), nullable=True)
