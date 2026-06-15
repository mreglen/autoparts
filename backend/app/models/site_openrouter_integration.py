from sqlalchemy import Boolean, Column, Date, DateTime, Integer, String, Text, func

from ..db.database import Base


class SiteOpenRouterIntegration(Base):
    __tablename__ = "site_openrouter_integration"

    id = Column(Integer, primary_key=True)
    api_key_encrypted = Column(Text, nullable=True)
    model_id = Column(String(128), nullable=False, default="meta-llama/llama-3.3-70b-instruct:free")
    is_enabled = Column(Boolean, nullable=False, default=False)
    daily_limit = Column(Integer, nullable=False, default=50)
    requests_today = Column(Integer, nullable=False, default=0)
    requests_today_date = Column(Date, nullable=True)
    per_org_daily_limit = Column(Integer, nullable=False, default=10)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
