from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func

from app.db.database import Base

SEO_LANDING_KINDS = (
    "brand_new",
    "category_new",
    "brand_used",
    "category_used",
    "geo",
)


class SeoLandingPage(Base):
    __tablename__ = "seo_landing_pages"
    __table_args__ = (UniqueConstraint("kind", "slug", name="uq_seo_landing_pages_kind_slug"),)

    id = Column(Integer, primary_key=True)
    kind = Column(String(32), nullable=False, index=True)
    slug = Column(String(120), nullable=False, index=True)
    title_ru = Column(String(255), nullable=False)
    search_query = Column(String(255), nullable=True)
    brand_name = Column(String(120), nullable=True)
    part_type_id = Column(Integer, ForeignKey("part_types.id"), nullable=True)
    city = Column(String(120), nullable=True)
    meta_title = Column(String(255), nullable=True)
    meta_description = Column(String(512), nullable=True)
    intro_html = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    priority = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
