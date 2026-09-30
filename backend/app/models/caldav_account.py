from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class CaldavAccount(Base):
    """CalDAV-аккаунт сотрудника для синхронизации записей на осмотр
    в Календарь и Напоминания iPhone (Radicale). Пароль в БД не хранится —
    только в htpasswd-файле Radicale."""

    __tablename__ = "caldav_accounts"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    organization_id = Column(String(10), ForeignKey("organizations.id"), nullable=False, index=True)
    caldav_username = Column(String(64), unique=True, nullable=False)
    last_synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    organization = relationship("Organization", foreign_keys=[organization_id])
