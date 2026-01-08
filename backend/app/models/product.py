from sqlalchemy import Column, Integer, Numeric, String, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from ..db.database import Base
from app.core.config import settings

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    article = Column(String(30))
    name = Column(String(255))
    brand = Column(String(100)) 
    internal_code = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text) 
    is_new = Column(Boolean, default=True)
    price = Column(Numeric(12, 2))
    quantity = Column(Integer)
    organization_id = Column(String, ForeignKey("organizations.id"))
    organization = relationship("Organization", back_populates="products")
    storage_location_id = Column(Integer, ForeignKey("storage_locations.id"))
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
   
    creator = relationship("User", foreign_keys=[created_by])
    photos = relationship("ProductPhoto", back_populates="product", cascade="all, delete-orphan")
    acquired_products = relationship("AcquiredProduct", back_populates="product")
    stock_ins = relationship("StockIn", back_populates="product")
    stock_outs = relationship("StockOut", back_populates="product")
    storage_location = relationship("StorageLocation")
    compatible_vehicles = relationship("Vehicle", secondary="product_vehicle_association", back_populates="compatible_products")

    @property
    def creator_name(self):
        if self.creator:
            initials = f"{self.creator.first_name[0]}." if self.creator.first_name else ""
            if self.creator.patronymic:
                initials += f"{self.creator.patronymic[0]}."
            return f"{self.creator.last_name or ''} {initials}".strip()
        return None

class ProductPhoto(Base):
    __tablename__ = "product_photos"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"))
    photo_url = Column(Text, nullable=False)

    product = relationship("Product", back_populates="photos")

    @property
    def full_url(self):
        # Если photo_url уже содержит полный URL со старым IP, исправляем его
        if self.photo_url.startswith('http://127.0.0.1'):
            filename = self.photo_url.split('/')[-1]
            return f"{settings.BASE_URL.rstrip('/')}/uploads/{filename}"
        # Если photo_url уже содержит полный URL с правильным IP, используем как есть
        elif self.photo_url.startswith('http://'):
            return self.photo_url
        # Если photo_url относительный, формируем полный URL
        else:
            filename = self.photo_url.split('/')[-1]
            return f"{settings.BASE_URL.rstrip('/')}/uploads/{filename}"