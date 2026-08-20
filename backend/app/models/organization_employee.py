from __future__ import annotations

from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base

# M2M: repair order assignees via organization employee cards
repair_order_employee_assignees = Table(
    "repair_order_employee_assignees",
    Base.metadata,
    Column(
        "order_id",
        Integer,
        ForeignKey("repair_orders.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "organization_employee_id",
        Integer,
        ForeignKey("organization_employees.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    UniqueConstraint(
        "order_id",
        "organization_employee_id",
        name="uq_repair_order_emp_assignees_order_employee",
    ),
)


class OrganizationEmployee(Base):
    """Unified org employee directory card; optional linked User account."""

    __tablename__ = "organization_employees"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "user_id",
            name="uq_organization_employees_org_user",
        ),
    )

    id = Column(Integer, primary_key=True)
    organization_id = Column(
        String(10),
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    legacy_service_employee_id = Column(
        Integer,
        ForeignKey("autoservice_service_employees.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    last_name = Column(String(100), nullable=False, default="")
    first_name = Column(String(100), nullable=False, default="")
    patronymic = Column(String(100), nullable=True)
    phone = Column(String(32), nullable=True)
    email = Column(String(255), nullable=True)
    position = Column(String(80), nullable=True)
    comment = Column(Text, nullable=True)

    is_service_executor = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    account_status = Column(String(32), nullable=False, default="no_account")
    hired_at = Column(DateTime, nullable=True)
    archived_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    organization = relationship("Organization", foreign_keys=[organization_id])
    user = relationship("User", foreign_keys=[user_id])
    legacy_service_employee = relationship(
        "AutoserviceServiceEmployee",
        foreign_keys=[legacy_service_employee_id],
    )
    permissions = relationship(
        "OrganizationEmployeePermission",
        back_populates="employee",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    payroll_terms = relationship(
        "OrganizationEmployeePayrollTerm",
        back_populates="employee",
        cascade="all, delete-orphan",
        order_by="OrganizationEmployeePayrollTerm.effective_from.desc()",
        lazy="selectin",
    )
    timesheet_entries = relationship(
        "OrganizationEmployeeTimesheetEntry",
        back_populates="employee",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    account_invites = relationship(
        "OrganizationEmployeeAccountInvite",
        back_populates="employee",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class OrganizationEmployeePermission(Base):
    __tablename__ = "organization_employee_permissions"
    __table_args__ = (
        UniqueConstraint(
            "organization_employee_id",
            "permission_id",
            name="uq_org_employee_permissions_employee_perm",
        ),
    )

    id = Column(Integer, primary_key=True)
    organization_employee_id = Column(
        Integer,
        ForeignKey("organization_employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    permission_id = Column(
        Integer,
        ForeignKey("permissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    employee = relationship("OrganizationEmployee", back_populates="permissions")
    permission = relationship("Permission", foreign_keys=[permission_id])


class OrganizationEmployeePayrollTerm(Base):
    __tablename__ = "organization_employee_payroll_terms"

    id = Column(Integer, primary_key=True)
    organization_employee_id = Column(
        Integer,
        ForeignKey("organization_employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    salary_type = Column(String(32), nullable=False, default="percent_work")
    salary_amount = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    work_percent = Column(Numeric(5, 2), nullable=False, default=Decimal("0.00"))
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    employee = relationship("OrganizationEmployee", back_populates="payroll_terms")


class OrganizationEmployeeTimesheetEntry(Base):
    __tablename__ = "organization_employee_timesheet_entries"
    __table_args__ = (
        UniqueConstraint(
            "organization_employee_id",
            "work_date",
            name="uq_org_employee_timesheet_employee_date",
        ),
    )

    id = Column(Integer, primary_key=True)
    organization_id = Column(
        String(10),
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )
    organization_employee_id = Column(
        Integer,
        ForeignKey("organization_employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    work_date = Column(Date, nullable=False, index=True)
    status = Column(String(16), nullable=False, default="draft")
    daily_rate_snapshot = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    confirmed_at = Column(DateTime, nullable=True)
    confirmed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    employee = relationship("OrganizationEmployee", back_populates="timesheet_entries")
    confirmed_by = relationship("User", foreign_keys=[confirmed_by_user_id])


class OrganizationEmployeeAccountInvite(Base):
    __tablename__ = "organization_employee_account_invites"

    id = Column(Integer, primary_key=True)
    organization_employee_id = Column(
        Integer,
        ForeignKey("organization_employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    invite_type = Column(String(32), nullable=False)
    target_email = Column(String(255), nullable=False)
    token_hash = Column(String(128), nullable=False, unique=True, index=True)
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(32), nullable=False, default="pending")
    expires_at = Column(DateTime, nullable=False)
    confirmed_at = Column(DateTime, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    employee = relationship("OrganizationEmployee", back_populates="account_invites")
    target_user = relationship("User", foreign_keys=[target_user_id])
    created_by = relationship("User", foreign_keys=[created_by_user_id])
