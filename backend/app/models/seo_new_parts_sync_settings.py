from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, func

from app.db.database import Base


class SeoNewPartsSyncSettings(Base):
    """Runtime overrides for Rossko SEO card creation rate (singleton id=1).

    NULL field = use env / Settings default.
    """

    __tablename__ = "seo_new_parts_sync_settings"

    id = Column(Integer, primary_key=True)
    daily_limit = Column(Integer, nullable=True)
    batch_interval_minutes = Column(Integer, nullable=True)
    batch_size = Column(Integer, nullable=True)
    rossko_delay_sec = Column(Float, nullable=True)
    seed_precheck_daily = Column(Integer, nullable=True)
    seed_precheck_interval_minutes = Column(Integer, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
