from sqlalchemy import Column, Integer, Text, ForeignKey, String
from sqlalchemy.orm import relationship
from ..db.database import Base

class PickupLocation(Base):
    __tablename__ = "pickup_locations"

    id = Column(Integer, primary_key=True, index=True)
    address = Column(Text)

    organization_id = Column(String, ForeignKey("organizations.id"))
    organization = relationship("Organization", back_populates="pickup_locations")
