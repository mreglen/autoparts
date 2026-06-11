from sqlalchemy import Column, DateTime, Integer, String, Text, func

from app.db.database import Base


class SeoRosskoSeedQueue(Base):
    __tablename__ = "seo_rossko_seed_queue"

    lookup_key = Column(String(255), primary_key=True)
    brand = Column(String(120), nullable=False)
    article = Column(String(120), nullable=False)
    source = Column(String(32), nullable=False, default="product", index=True)
    status = Column(String(32), nullable=False, default="pending", index=True)
    priority = Column(Integer, nullable=False, default=100)
    rossko_payload_json = Column(Text, nullable=True)
    rossko_checked_at = Column(DateTime(timezone=True), nullable=True)
    next_retry_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
