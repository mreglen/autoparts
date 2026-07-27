from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class AutoserviceSettings(Base):
    __tablename__ = "autoservice_settings"

    id = Column(Integer, primary_key=True)
    organization_id = Column(
        String(10),
        ForeignKey("organizations.id"),
        nullable=False,
        unique=True,
        index=True,
    )
    lifts_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    organization = relationship("Organization", foreign_keys=[organization_id])
