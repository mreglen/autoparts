from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func

from app.db.database import Base


class AutoserviceTariffApplication(Base):
    __tablename__ = "autoservice_tariff_applications"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(String(10), ForeignKey("organizations.id"), nullable=False, index=True)
    applicant_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    contact_name = Column(String(160), nullable=False)
    contact_phone = Column(String(32), nullable=False)
    message = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="pending", index=True)
    rejection_reason = Column(Text, nullable=True)
    reviewed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
