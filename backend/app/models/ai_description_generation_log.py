from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func

from ..db.database import Base


class AiDescriptionGenerationLog(Base):
    __tablename__ = "ai_description_generation_log"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(String(10), ForeignKey("organizations.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True, index=True)
    brand = Column(String(120), nullable=True)
    article = Column(String(120), nullable=True)
    model_id = Column(String(128), nullable=True)
    tokens_used = Column(Integer, nullable=True)
    status = Column(String(32), nullable=False, default="success")
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
