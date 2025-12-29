# app/models/product_vehicle.py
from sqlalchemy import Column, Integer, ForeignKey
from ..db.database import Base

class ProductVehicleAssociation(Base):
    __tablename__ = "product_vehicle_association"

    product_id = Column(
        Integer, 
        ForeignKey("products.id", ondelete="CASCADE"), 
        primary_key=True
    )
    vehicle_id = Column(
        Integer, 
        ForeignKey("vehicles.id", ondelete="CASCADE"), 
        primary_key=True
    )