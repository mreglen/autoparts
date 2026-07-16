from sqlalchemy import Column, Integer, Numeric, String, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..db.database import Base
from app.core.config import settings

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    article = Column(String(30), index=True)  # Индекс для поиска по артикулу
    name = Column(String(255), index=True)   # Индекс для поиска по названию
    brand = Column(String(100), index=True)  # Индекс для поиска по бренду 
    internal_code = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text) 
    is_new = Column(Boolean, default=True)
    price = Column(Numeric(12, 2))
    quantity = Column(Integer)
    organization_id = Column(String, ForeignKey("organizations.id"))
    organization = relationship("Organization", back_populates="products")
    storage_location_id = Column(Integer, ForeignKey("storage_locations.id"))
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    part_type_id = Column(Integer, ForeignKey("part_types.id"), nullable=False)
    source_pending_id = Column(Integer, nullable=True, index=True)
   
    creator = relationship("User", foreign_keys=[created_by])
    photos = relationship("ProductPhoto", back_populates="product", cascade="all, delete-orphan")
    videos = relationship("ProductVideo", back_populates="product", cascade="all, delete-orphan")
    acquired_products = relationship("AcquiredProduct", back_populates="product")
    stock_ins = relationship("StockIn", back_populates="product")
    stock_outs = relationship("StockOut", back_populates="product")
    storage_location = relationship("StorageLocation")
    compatible_vehicles = relationship("Vehicle", secondary="product_vehicle_association", back_populates="compatible_products")
    part_type = relationship("PartType", back_populates="products")
    avito_listing_links = relationship("ProductAvitoListingLink", back_populates="product", cascade="all, delete-orphan")
    drom_listing_links = relationship("ProductDromListingLink", back_populates="product", cascade="all, delete-orphan")

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
    thumb_url = Column(Text, nullable=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True, index=True)
    processing_status = Column(String(20), default='pending')  # pending, processing, completed, failed
    
    product = relationship("Product", back_populates="photos")
    organization = relationship("Organization")

    @property
    def full_url(self):
        # If photo_url already contains a full URL, use as is
        if self.photo_url.startswith('http://') or self.photo_url.startswith('https://'):
            return self.photo_url
        else:
            # Add /uploads prefix for local storage paths
            if not self.photo_url.startswith('/uploads/'):
                return f"/uploads{self.photo_url}"
            return self.photo_url

    @property
    def list_photo_url(self) -> str:
        return (self.thumb_url or self.photo_url or "").strip()


class ProductVideo(Base):
    __tablename__ = "product_videos"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"))
    video_url = Column(Text, nullable=False)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True, index=True)
    processing_status = Column(String(20), default='pending')  # pending, processing, completed, failed
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    product = relationship("Product", back_populates="videos")
    organization = relationship("Organization")

    @property
    def full_url(self):
        # If video_url already contains a full URL, use as is
        if self.video_url.startswith('http://') or self.video_url.startswith('https://'):
            return self.video_url
        else:
            # Add /uploads prefix for local storage paths
            if not self.video_url.startswith('/uploads/'):
                return f"/uploads{self.video_url}"
            return self.video_url