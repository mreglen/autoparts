from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from ..db.database import Base


class VehiclePhoto(Base):
    __tablename__ = "vehicle_photos"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(String(10), ForeignKey("organizations.id"), nullable=True, index=True)
    photo_path = Column(Text, nullable=False)
    processing_status = Column(String(20), default="pending", nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)

    vehicle = relationship("Vehicle", back_populates="photos")
    organization = relationship("Organization")

    @property
    def full_url(self):
        if not self.photo_path:
            return None
        if self.photo_path.startswith("http://") or self.photo_path.startswith("https://"):
            return self.photo_path
        if self.photo_path.startswith("/uploads/"):
            return self.photo_path
        return f"/uploads{self.photo_path}" if self.photo_path.startswith("/") else f"/uploads/{self.photo_path}"
