from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, func

from ..db.database import Base


class OrganizationAvitoAutoloadCache(Base):
    """Последний успешно разобранный файл автозагрузки (для отображения на странице интеграции)."""

    __tablename__ = "organization_avito_autoload_cache"

    organization_id = Column(String(10), ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True)
    items_json = Column(Text, nullable=False, default="[]")
    saved_path = Column(String(512), nullable=True)
    local_validation_ok = Column(Boolean, nullable=False, default=True)
    local_errors_json = Column(Text, nullable=False, default="[]")
    sheets_parsed_json = Column(Text, nullable=False, default="[]")
    avito_upload_json = Column(Text, nullable=True)
    avito_upload_status = Column(Integer, nullable=True)
    avito_report_json = Column(Text, nullable=True)
    avito_token_error = Column(Text, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
