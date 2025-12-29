from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from ..db.database import Base

class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    brand = Column(String(50), nullable=False)
    model = Column(String(100), nullable=False)
    generation = Column(String(50))  
    engine = Column(String(50))     
    transmission = Column(String(30)) 
    vin = Column(String(17))
    mileage = Column(Integer)  # Пробег в километрах
    organization_id = Column(String, ForeignKey("organizations.id"))
    organization = relationship("Organization")

    compatible_products = relationship(
        "Product",
        secondary="product_vehicle_association",
        back_populates="compatible_vehicles"
    )