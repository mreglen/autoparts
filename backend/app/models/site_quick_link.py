from sqlalchemy import Boolean, Column, DateTime, Integer, String, func

from app.db.database import Base


class SiteQuickLink(Base):
    __tablename__ = "site_quick_links"

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    url = Column(String(512), nullable=False)
    enabled = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
