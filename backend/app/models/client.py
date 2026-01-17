from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from ..db.database import Base

class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    last_name = Column(String(100), nullable=False)
    first_name = Column(String(100), nullable=False)
    patronymic = Column(String(100), nullable=True)
    email = Column(String(255), unique=True, index=True)
    phone = Column(String(20), nullable=False)
    
    # Foreign key to organization
    organization_id = Column(String(10), ForeignKey("organizations.id"), nullable=False)
    
    # Relationships
    organization = relationship("Organization", back_populates="clients")

    @property
    def full_name(self):
        """Return full name of the client"""
        name_parts = [self.last_name, self.first_name]
        if self.patronymic:
            name_parts.append(self.patronymic)
        return " ".join(name_parts)