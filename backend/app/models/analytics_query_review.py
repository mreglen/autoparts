from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.db.database import Base


class AnalyticsQueryReviewSnapshot(Base):
    __tablename__ = "analytics_query_review_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    source = Column(String(32), nullable=False, default="yandex_webmaster", index=True)
    status = Column(String(32), nullable=False, default="ok", index=True)
    error_message = Column(Text, nullable=True)


class AnalyticsQueryReviewItem(Base):
    __tablename__ = "analytics_query_review_items"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_id = Column(
        Integer,
        ForeignKey("analytics_query_review_snapshots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    query_text = Column(String(512), nullable=False)
    cluster = Column(String(16), nullable=False, default="unknown")
    impressions = Column(Integer, nullable=False, default=0)
    clicks = Column(Integer, nullable=False, default=0)
    ctr = Column(String(16), nullable=False, default="0")
    position = Column(String(16), nullable=False, default="0")
    matched_path = Column(String(512), nullable=True)
    recommendation = Column(String(32), nullable=False, default="review")
    recommendation_label = Column(String(128), nullable=False, default="")
    sort_order = Column(Integer, nullable=False, default=0)
