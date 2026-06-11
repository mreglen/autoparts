from sqlalchemy import Column, DateTime, Integer, String, func

from app.db.database import Base


class SeoSyncPendingCandidate(Base):
    __tablename__ = "seo_sync_pending_candidates"

    lookup_key = Column(String(255), primary_key=True)
    brand = Column(String(120), nullable=False)
    article = Column(String(120), nullable=False)
    source = Column(String(32), nullable=False, default="cross", index=True)
    priority = Column(Integer, nullable=False, default=100)
    discovered_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
