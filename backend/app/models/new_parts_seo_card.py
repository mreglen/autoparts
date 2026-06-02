from sqlalchemy import Boolean, Column, DateTime, Integer, Numeric, String, Text
from sqlalchemy.sql import func

from app.db.database import Base


class NewPartsSeoCard(Base):
    __tablename__ = "new_parts_seo_cards"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String(32), nullable=False, default="rossko", index=True)
    stable_key = Column(String(255), nullable=False, unique=True, index=True)
    brand = Column(String(120), nullable=False, index=True)
    article = Column(String(120), nullable=False, index=True)
    name = Column(String(512), nullable=True)
    description = Column(Text, nullable=True)
    price = Column(Numeric(12, 2), nullable=True)
    currency = Column(String(8), nullable=False, default="RUB")
    stock_count = Column(Integer, nullable=True)
    delivery_start = Column(DateTime(timezone=True), nullable=True)
    delivery_end = Column(DateTime(timezone=True), nullable=True)
    image_url = Column(Text, nullable=True)
    raw_payload = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
