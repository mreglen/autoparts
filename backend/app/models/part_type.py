from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from ..db.database import Base

class PartType(Base):
    __tablename__ = "part_types"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    
    # Relationship
    products = relationship("Product", back_populates="part_type")
