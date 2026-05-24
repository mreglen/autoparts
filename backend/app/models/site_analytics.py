from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.db.database import Base


class SiteAnalyticsSession(Base):
    __tablename__ = "site_analytics_sessions"

    id = Column(Integer, primary_key=True, index=True)
    visitor_id = Column(String(64), nullable=False, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    duration_sec = Column(Integer, nullable=False, default=0)
    page_views_count = Column(Integer, nullable=False, default=0)


class SiteAnalyticsPageView(Base):
    __tablename__ = "site_analytics_page_views"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("site_analytics_sessions.id"), nullable=False, index=True)
    client_view_id = Column(String(64), nullable=True, index=True)
    path_template = Column(String(512), nullable=False, index=True)
    path_raw = Column(String(2048), nullable=False)
    entered_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    duration_sec = Column(Integer, nullable=False, default=0)


class SiteAnalyticsFormEvent(Base):
    __tablename__ = "site_analytics_form_events"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("site_analytics_sessions.id"), nullable=False, index=True)
    form_id = Column(String(64), nullable=False, index=True)
    field_name = Column(String(128), nullable=True)
    event_type = Column(String(32), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
