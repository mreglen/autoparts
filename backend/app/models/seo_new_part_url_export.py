from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.sql import func

from ..db.database import Base


class SeoNewPartUrlExport(Base):
    """SEO-карточка Rossko, уже попавшая в ежедневную SEO-выгрузку URL."""

    __tablename__ = "seo_new_part_url_exports"

    id = Column(Integer, primary_key=True, index=True)
    card_id = Column(Integer, ForeignKey("new_parts_seo_cards.id"), nullable=False, index=True)
    export_date = Column(Date, nullable=False, index=True)
    exported_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("card_id", name="uq_seo_new_part_url_exports_card_id"),
    )
