from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class EmployeeWorkZone(Base):
    """Связь сотрудника организации с рабочими зонами автосервиса.

    work_zone_id IS NULL — псевдозона «Без рабочей зоны» из планировщика.
    """

    __tablename__ = "employee_work_zones"
    __table_args__ = (
        UniqueConstraint(
            "organization_employee_id",
            "work_zone_id",
            name="uq_employee_work_zone_employee_zone",
        ),
    )

    id = Column(Integer, primary_key=True)
    organization_employee_id = Column(
        Integer,
        ForeignKey("organization_employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    work_zone_id = Column(
        Integer,
        ForeignKey("autoservice_work_zones.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    can_view = Column(Boolean, nullable=False, default=True)
    can_edit = Column(Boolean, nullable=False, default=False)
    can_caldav = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    employee = relationship("OrganizationEmployee", foreign_keys=[organization_employee_id])
    work_zone = relationship("AutoserviceWorkZone", foreign_keys=[work_zone_id])
