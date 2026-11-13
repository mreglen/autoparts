from decimal import Decimal

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class AutoserviceExpenseArticle(Base):
    __tablename__ = "autoservice_expense_articles"
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_autoservice_expense_articles_org_name"),
    )

    id = Column(Integer, primary_key=True)
    organization_id = Column(
        String(10),
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )
    name = Column(String(120), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    organization = relationship("Organization", foreign_keys=[organization_id])


class AutoserviceExpense(Base):
    __tablename__ = "autoservice_expenses"

    id = Column(Integer, primary_key=True)
    organization_id = Column(
        String(10),
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )
    type = Column(String(32), nullable=False)  # salary | other
    article_id = Column(
        Integer,
        ForeignKey("autoservice_expense_articles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    amount = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    expense_date = Column(DateTime, nullable=False, index=True)
    description = Column(String(255), nullable=True)
    employee_id = Column(
        Integer,
        ForeignKey("autoservice_service_employees.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_by_user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    is_deleted = Column(Boolean, nullable=False, default=False)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by_user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    organization = relationship("Organization", foreign_keys=[organization_id])
    article = relationship("AutoserviceExpenseArticle", foreign_keys=[article_id])
    employee = relationship("AutoserviceServiceEmployee", foreign_keys=[employee_id])
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    deleted_by = relationship("User", foreign_keys=[deleted_by_user_id])
