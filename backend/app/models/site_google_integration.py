from sqlalchemy import BigInteger, Column, DateTime, Integer, String, Text, func

from ..db.database import Base


class SiteGoogleIntegration(Base):
    __tablename__ = "site_google_integration"

    id = Column(Integer, primary_key=True)

    client_id = Column(String(255), nullable=True)
    client_secret_encrypted = Column(Text, nullable=True)

    access_token_encrypted = Column(Text, nullable=True)
    refresh_token_encrypted = Column(Text, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)

    site_url = Column(String(1024), nullable=True)

    oauth_connected_at = Column(DateTime, nullable=True)
    last_token_refresh_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
