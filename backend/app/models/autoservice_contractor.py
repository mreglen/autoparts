from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class AutoserviceContractor(Base):
    __tablename__ = "autoservice_contractors"
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_autoservice_contractors_org_name"),
    )

    id = Column(Integer, primary_key=True)
    organization_id = Column(
        String(10),
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )
    name = Column(String(120), nullable=False)
    phone = Column(String(32), nullable=True)
    note = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    person_type_default = Column(String(16), nullable=False, default="individual")
    ind_name = Column(String(255), nullable=True)
    ie_name = Column(String(255), nullable=True)
    legal_name = Column(String(255), nullable=True)
    inn_individual = Column(String(12), nullable=True)
    inn_ie = Column(String(12), nullable=True)
    inn_legal = Column(String(12), nullable=True)
    kpp = Column(String(9), nullable=True)
    ogrnip = Column(String(15), nullable=True)
    ogrn = Column(String(15), nullable=True)
    address = Column(Text, nullable=True)
    email = Column(String(255), nullable=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    organization = relationship("Organization", foreign_keys=[organization_id])
