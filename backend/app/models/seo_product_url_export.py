from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.sql import func

from ..db.database import Base


class SeoProductUrlExport(Base):
    """Товар, уже попавший в ежедневную SEO-выгрузку URL карточек."""

    __tablename__ = "seo_product_url_exports"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    export_date = Column(Date, nullable=False, index=True)
    exported_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("product_id", name="uq_seo_product_url_exports_product_id"),
    )
