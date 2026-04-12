from sqlalchemy import Column, Integer, Numeric, String, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..db.database import Base


class PendingProduct(Base):
    __tablename__ = "pending_products"

    id = Column(Integer, primary_key=True, index=True)
    article = Column(String(30), index=True)
    name = Column(String(255), index=True)
    brand = Column(String(100), index=True)
    internal_code = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text)
    is_new = Column(Boolean, default=True)
    price = Column(Numeric(12, 2))
    quantity = Column(Integer)
    organization_id = Column(String, ForeignKey("organizations.id"))
    storage_location_id = Column(Integer, ForeignKey("storage_locations.id"))
    part_type_id = Column(Integer, ForeignKey("part_types.id"))  # Required field
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=func.now())
    photos = Column(Text)  # JSON строка с URL фото
    videos = Column(Text)  # JSON строка с URL видео
    vehicle_ids = Column(Text)  # JSON строка с ID автомобилей
    
    # Relationships
    organization = relationship("Organization")
    storage_location = relationship("StorageLocation")
    creator = relationship("User", foreign_keys=[created_by])
    # Note: pending_product_storage_cells relationship is defined in pending_product_storage_cell.py
    # to avoid circular import issues during SQLAlchemy initialization


    @property
    def creator_name(self):
        if self.creator:
            initials = f"{self.creator.first_name[0]}." if self.creator.first_name else ""
            if self.creator.patronymic:
                initials += f"{self.creator.patronymic[0]}."
            return f"{self.creator.last_name or ''} {initials}".strip()
        return None