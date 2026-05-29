from sqlalchemy import Column, DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.sql import func

from ..db.database import Base


class SeoSitemapCache(Base):
    """Кэш сгенерированного sitemap (products)."""

    __tablename__ = "seo_sitemap_cache"

    id = Column(Integer, primary_key=True, index=True)
    cache_key = Column(String(32), nullable=False, index=True)
    xml_content = Column(Text, nullable=False)
    url_count = Column(Integer, nullable=False, default=0)
    generated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("cache_key", name="uq_seo_sitemap_cache_cache_key"),
    )
