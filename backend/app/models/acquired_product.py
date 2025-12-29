from sqlalchemy import Column, Integer, Numeric, Boolean, Date, ForeignKey, String
from sqlalchemy.orm import relationship
from ..db.database import Base

class AcquiredProduct(Base):
    __tablename__ = "acquired_products"

    id = Column(Integer, primary_key=True, index=True)
    purchase_price = Column(Numeric(12, 2))
    is_kit = Column(Boolean, default=False)
    acquisition_date = Column(Date)

    product_id = Column(Integer, ForeignKey("products.id"))
    organization_id = Column(String, ForeignKey("organizations.id"))

    product = relationship("Product", back_populates="acquired_products")
    organization = relationship("Organization", back_populates="acquired_products")
    stock_ins = relationship("StockIn", back_populates="acquired_product")
    stock_outs = relationship("StockOut", back_populates="acquired_product")