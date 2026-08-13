from sqlalchemy import Column, Date, DateTime, Integer, String, UniqueConstraint, func

from app.db.database import Base


class AutoserviceDigestLog(Base):
    __tablename__ = "autoservice_digest_log"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "digest_date",
            "kind",
            name="uq_autoservice_digest_log_org_date_kind",
        ),
    )

    id = Column(Integer, primary_key=True)
    organization_id = Column(String(10), nullable=False, index=True)
    digest_date = Column(Date, nullable=False, index=True)
    kind = Column(String(32), nullable=False, default="planner_daily")
    sent_at = Column(DateTime, server_default=func.now(), nullable=False)
