from decimal import Decimal

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class AutoserviceServiceEmployee(Base):
    __tablename__ = "autoservice_service_employees"

    id = Column(Integer, primary_key=True)
    organization_id = Column(
        String(10),
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )
    name = Column(String(120), nullable=False)
    phone = Column(String(32), nullable=True)
    position = Column(String(80), nullable=True)
    salary_type = Column(String(32), nullable=False, default="percent_work")
    salary_amount = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    work_percent = Column(Numeric(5, 2), nullable=False, default=Decimal("0.00"))
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    organization = relationship("Organization", foreign_keys=[organization_id])
