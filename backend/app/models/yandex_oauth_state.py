from sqlalchemy import Boolean, Column, DateTime, Integer, String, func

from ..db.database import Base


class YandexOAuthState(Base):
    __tablename__ = "yandex_oauth_state"

    state = Column(String(128), primary_key=True)
    created_by_user_id = Column(Integer, nullable=False, index=True)
    redirect_to = Column(String(512), nullable=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    used = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
