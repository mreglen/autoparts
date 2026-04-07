from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import relationship

from ..db.database import Base


class ProductAvitoListingLink(Base):
    __tablename__ = "product_avito_listing_links"
    __table_args__ = (
        UniqueConstraint("organization_id", "avito_ad_id", name="uq_product_avito_listing_org_ad"),
    )

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(String(10), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    avito_ad_id = Column(String(64), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    product = relationship("Product")
