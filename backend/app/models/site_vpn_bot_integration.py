from sqlalchemy import Boolean, Column, DateTime, Integer, Text, func

from ..db.database import Base


class SiteVpnBotIntegration(Base):
    __tablename__ = "site_vpn_bot_integration"

    id = Column(Integer, primary_key=True)
    bot_token_encrypted = Column(Text, nullable=True)
    is_enabled = Column(Boolean, nullable=False, default=False)
    last_apply_status = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
