from sqlalchemy import Boolean, Column, DateTime, Integer, Numeric, String, Text, func

from app.db.database import Base


class SiteDeliveryOption(Base):
    __tablename__ = "site_delivery_options"

    id = Column(Integer, primary_key=True)
    region_id = Column(Integer, nullable=False, index=True)
    region_name = Column(String(255), nullable=False)
    delivery_type = Column(String(32), nullable=False)  # pickup | pvz | courier
    carrier = Column(String(255), nullable=True)
    pickup_point = Column(Text, nullable=True)
    min_order_amount = Column(Numeric(12, 2), nullable=False, default=0)
    enabled = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
