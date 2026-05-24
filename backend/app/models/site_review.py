from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class SiteReview(Base):
    __tablename__ = "site_reviews"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    author_name = Column(String(120), nullable=False)
    author_role = Column(String(80), nullable=True)
    text = Column(Text, nullable=False)
    rating = Column(Integer, nullable=False, default=5)
    source = Column(String(32), nullable=False, default="platform")
    review_date = Column(DateTime, nullable=True)
    featured = Column(Boolean, nullable=False, default=False)
    enabled = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", foreign_keys=[user_id])
