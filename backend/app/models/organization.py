from sqlalchemy import Column, Integer, String, Text, ForeignKey, Float, Boolean
from sqlalchemy.orm import relationship
from ..db.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String(10), primary_key=True, index=True)
    name = Column(String(255))
    address = Column(Text)
    phone = Column(String(20))
    logo_organization = Column(Text)
    description = Column(Text)
    watermark = Column(Integer, default=1)
    new_parts_markup_percent = Column(Float, nullable=True)
    new_parts_markup_manual = Column(Boolean, nullable=False, default=False)
    users = relationship("User", back_populates="organization")
    avito_integration = relationship(
        "OrganizationAvitoIntegration",
        back_populates="organization",
        uselist=False,
    )
    drom_integration = relationship(
        "OrganizationDromIntegration",
        back_populates="organization",
        uselist=False,
        cascade="all, delete-orphan",
    )
    products = relationship("Product", back_populates="organization")
    acquired_products = relationship("AcquiredProduct", back_populates="organization")
    storage_locations = relationship("StorageLocation", back_populates="organization")
    pickup_locations = relationship("PickupLocation", back_populates="organization")
    stock_ins = relationship("StockIn", back_populates="organization")
    stock_outs = relationship("StockOut", back_populates="organization")
    clients = relationship("Client", back_populates="organization")
