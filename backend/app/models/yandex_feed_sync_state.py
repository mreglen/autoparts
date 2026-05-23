from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, func

from ..db.database import Base


class YandexFeedSyncState(Base):
    __tablename__ = "yandex_feed_sync_state"

    id = Column(Integer, primary_key=True)

    pending_sync = Column(Boolean, nullable=False, default=False)
    sync_in_progress = Column(Boolean, nullable=False, default=False)
    last_change_reason = Column(String(128), nullable=True)
    last_event_at = Column(DateTime, nullable=True)
    last_enqueued_at = Column(DateTime, nullable=True)

    last_feed_url = Column(String(1024), nullable=True)
    last_checksum = Column(String(128), nullable=True)
    last_request_id = Column(String(128), nullable=True)
    last_process_status = Column(String(64), nullable=True)

    last_sync_started_at = Column(DateTime, nullable=True)
    last_sync_finished_at = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)
    consecutive_failures = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
