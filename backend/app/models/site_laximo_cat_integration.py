from sqlalchemy import Boolean, Column, Date, DateTime, Integer, String, Text, func

from ..db.database import Base

DEFAULT_LAXIMO_CAT_BASE_URL = "https://ws.laximo.ru/restApi/v1"
DEFAULT_DAILY_REQUEST_LIMIT = 500
DEFAULT_PRODUCT_CARD_DAILY_REQUEST_LIMIT = 10


class SiteLaximoCatIntegration(Base):
    __tablename__ = "site_laximo_cat_integration"

    id = Column(Integer, primary_key=True)
    login_encrypted = Column(Text, nullable=True)
    password_encrypted = Column(Text, nullable=True)
    base_url = Column(String(512), nullable=False, default=DEFAULT_LAXIMO_CAT_BASE_URL)
    is_enabled = Column(Boolean, nullable=False, default=False)
    last_test_ok = Column(Boolean, nullable=False, default=False)
    last_tested_at = Column(DateTime, nullable=True)
    last_test_error = Column(Text, nullable=True)
    last_test_catalogs_count = Column(Integer, nullable=True)
    daily_request_limit = Column(Integer, nullable=False, default=DEFAULT_DAILY_REQUEST_LIMIT)
    requests_today = Column(Integer, nullable=False, default=0)
    requests_day = Column(Date, nullable=True)
    quota_exhausted_at = Column(DateTime, nullable=True)
    product_card_daily_request_limit = Column(
        Integer, nullable=False, default=DEFAULT_PRODUCT_CARD_DAILY_REQUEST_LIMIT
    )
    product_card_requests_today = Column(Integer, nullable=False, default=0)
    product_card_requests_day = Column(Date, nullable=True)
    product_card_quota_exhausted_at = Column(DateTime, nullable=True)
    last_upstream_error_at = Column(DateTime, nullable=True)
    last_upstream_error = Column(Text, nullable=True)
    # Laximo.DOC (FindOEM / analogs) — separate credentials & gate
    doc_login_encrypted = Column(Text, nullable=True)
    doc_password_encrypted = Column(Text, nullable=True)
    doc_base_url = Column(String(512), nullable=False, default=DEFAULT_LAXIMO_CAT_BASE_URL)
    doc_is_enabled = Column(Boolean, nullable=False, default=False)
    doc_last_test_ok = Column(Boolean, nullable=False, default=False)
    doc_last_tested_at = Column(DateTime, nullable=True)
    doc_last_test_error = Column(Text, nullable=True)
    doc_requests_today = Column(Integer, nullable=False, default=0)
    doc_requests_day = Column(Date, nullable=True)
    doc_quota_exhausted_at = Column(DateTime, nullable=True)
    doc_last_upstream_error_at = Column(DateTime, nullable=True)
    doc_last_upstream_error = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
