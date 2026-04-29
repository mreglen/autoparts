from sqlalchemy import Column, Integer, Numeric, Date, ForeignKey, String, Text
from sqlalchemy.orm import relationship
from ..db.database import Base

class StockOut(Base):
    __tablename__ = "stock_out"

    id = Column(Integer, primary_key=True, index=True)
    quantity = Column(Integer)
    sale_price = Column(Numeric(12, 2))
    movement_date = Column(Date)

    organization_id = Column(String, ForeignKey("organizations.id"))
    storage_location_id = Column(Integer, ForeignKey("storage_locations.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    acquired_product_id = Column(Integer, ForeignKey("acquired_products.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reason = Column(Text, nullable=True)
    sale_channel = Column(String(50), nullable=True)  # 'avito', 'drom', 'warehouse', etc.
    avito_order_id = Column(String(64), nullable=True)  # ID заказа Авито для связи  

    organization = relationship("Organization", back_populates="stock_outs")
    storage_location = relationship("StorageLocation", back_populates="stock_outs")
    product = relationship("Product", back_populates="stock_outs")
    acquired_product = relationship("AcquiredProduct", back_populates="stock_outs")
    user = relationship("User", back_populates="stock_outs")