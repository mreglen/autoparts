from sqlalchemy import BigInteger, Boolean, Column, DateTime, Integer, String, Text, func

from ..db.database import Base


class SiteYandexIntegration(Base):
    __tablename__ = "site_yandex_integration"

    id = Column(Integer, primary_key=True)

    # OAuth app credentials
    client_id = Column(String(255), nullable=True)
    client_secret_encrypted = Column(Text, nullable=True)

    # OAuth tokens
    access_token_encrypted = Column(Text, nullable=True)
    refresh_token_encrypted = Column(Text, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)

    # Yandex Webmaster bindings
    yandex_user_id = Column(BigInteger, nullable=True)
    host_id = Column(String(255), nullable=True)
    host_url = Column(String(1024), nullable=True)

    # Feed configuration
    feed_type = Column(String(32), nullable=False, default="GOODS")
    region_ids_csv = Column(String(255), nullable=False, default="225")
    used_condition_type = Column(String(32), nullable=False, default="preowned")
    used_condition_reason = Column(
        Text,
        nullable=False,
        default="Товар бывший в употреблении, проверен продавцом",
    )
    event_driven_enabled = Column(Boolean, nullable=False, default=True)
    debounce_seconds = Column(Integer, nullable=False, default=300)
    control_sync_interval_minutes = Column(Integer, nullable=False, default=720)
    enabled = Column(Boolean, nullable=False, default=True)

    oauth_connected_at = Column(DateTime, nullable=True)
    last_token_refresh_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
