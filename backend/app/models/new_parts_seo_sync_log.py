from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.db.database import Base


class NewPartsSeoSyncLog(Base):
    __tablename__ = "new_parts_seo_sync_log"

    id = Column(Integer, primary_key=True, index=True)
    lookup_key = Column(String(255), nullable=False, unique=True, index=True)
    lookup_brand = Column(String(120), nullable=False)
    lookup_article = Column(String(120), nullable=False)
    rossko_brand = Column(String(120), nullable=True)
    rossko_article = Column(String(120), nullable=True)
    seo_card_id = Column(Integer, ForeignKey("new_parts_seo_cards.id"), nullable=True, index=True)
    status = Column(String(32), nullable=False, index=True)
    error_message = Column(Text, nullable=True)
    checked_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    next_retry_at = Column(DateTime(timezone=True), nullable=True, index=True)
