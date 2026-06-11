from sqlalchemy import Column, Date, Integer

from app.db.database import Base


class SeoSyncDailyCounter(Base):
    __tablename__ = "seo_sync_daily_counters"

    stat_date = Column(Date, primary_key=True)
    cross_recurse_calls = Column(Integer, nullable=False, default=0)
    precheck_calls = Column(Integer, nullable=False, default=0)
