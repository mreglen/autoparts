from sqlalchemy import Column, Integer, String, UniqueConstraint

from app.db.database import Base


class AutoserviceCounter(Base):
    """Per-organization atomic counters (order numbers, payment numbers)."""

    __tablename__ = "autoservice_counters"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "kind",
            name="uq_autoservice_counters_org_kind",
        ),
    )

    id = Column(Integer, primary_key=True)
    organization_id = Column(String(10), nullable=False, index=True)
    kind = Column(String(32), nullable=False)
    value = Column(Integer, nullable=False, default=0)
