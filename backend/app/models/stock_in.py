from sqlalchemy import Column, Date, Integer, Numeric, DateTime, ForeignKey, String, func
from sqlalchemy.orm import relationship
from ..db.database import Base

class StockIn(Base):
    __tablename__ = "stock_in"

    id = Column(Integer, primary_key=True, index=True)
    quantity = Column(Integer)
    sale_price = Column(Numeric(12, 2))
    created_at = Column(Date, default=func.now(), nullable=False)

    organization_id = Column(String, ForeignKey("organizations.id"))
    storage_location_id = Column(Integer, ForeignKey("storage_locations.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    acquired_product_id = Column(Integer, ForeignKey("acquired_products.id"))
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    creator = relationship("User", foreign_keys=[created_by])
    organization = relationship("Organization", back_populates="stock_ins")
    storage_location = relationship("StorageLocation", back_populates="stock_ins")
    product = relationship("Product", back_populates="stock_ins")
    acquired_product = relationship("AcquiredProduct", back_populates="stock_ins")

    @property
    def creator_name(self):
        if self.creator:
            initials = f"{self.creator.first_name[0]}." if self.creator.first_name else ""
            if self.creator.patronymic:
                initials += f"{self.creator.patronymic[0]}."
            return f"{self.creator.last_name or ''} {initials}".strip()
        return None