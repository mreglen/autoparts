from sqlalchemy import Column, Integer, Numeric, String, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..db.database import Base


class ProductDraft(Base):
    __tablename__ = "product_drafts"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    article = Column(String(30), nullable=True)
    name = Column(String(255), nullable=True)
    brand = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    is_new = Column(Boolean, default=True)
    price = Column(Numeric(12, 2), nullable=True)
    quantity = Column(Integer, nullable=True)
    storage_location_id = Column(Integer, ForeignKey("storage_locations.id"), nullable=True)
    part_type_id = Column(Integer, ForeignKey("part_types.id"), nullable=True)

    photos = Column(Text, nullable=True)
    videos = Column(Text, nullable=True)
    vehicle_ids = Column(Text, nullable=True)
    storage_cells_json = Column(Text, nullable=True)

    organization = relationship("Organization")
    storage_location = relationship("StorageLocation")
    creator = relationship("User", foreign_keys=[created_by])

    @property
    def creator_name(self):
        from app.utils.user_display_name import format_user_short_name

        return format_user_short_name(self.creator)
