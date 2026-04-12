from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, func, UniqueConstraint
from sqlalchemy.orm import relationship

from ..db.database import Base


class ProductDromListingLink(Base):
    __tablename__ = "product_drom_listing_link"

    id = Column(Integer, primary_key=True, autoincrement=True)
    organization_id = Column(String(10), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    drom_offer_id = Column(String(100), nullable=True)
    drom_status = Column(String(50), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('organization_id', 'product_id', name='uq_org_product_drom'),
    )

    organization = relationship("Organization")
    product = relationship("Product")
