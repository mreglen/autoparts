from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.site_laximo_cat_integration import SiteLaximoCatIntegration
from app.utils.laximo_cat_integration_db import get_or_create_laximo_cat_integration
from app.utils.laximo_crypto import decrypt_laximo_secret

INTERNAL_NOT_CONFIGURED = "not_configured"
INTERNAL_NOT_VERIFIED = "not_verified"
INTERNAL_DISABLED = "disabled"
INTERNAL_QUOTA_EXHAUSTED = "quota_exhausted"
INTERNAL_UPSTREAM_ERROR = "upstream_error"
INTERNAL_NOT_FOUND = "not_found"
INTERNAL_READY = "ready"

PUBLIC_TEMPORARILY_UNAVAILABLE = "temporarily_unavailable"
PUBLIC_NOT_FOUND = "not_found"
PUBLIC_OK = "ok"

PUBLIC_UNAVAILABLE_TITLE = "Сервис временно недоступен"
PUBLIC_UNAVAILABLE_MESSAGE = (
    "Простите, сейчас поиск автомобиля по VIN, госномеру или Frame временно не работает. "
    "Попробуйте позже или заполните данные вручную."
)
PUBLIC_NOT_FOUND_TITLE = "Автомобиль не найден"
PUBLIC_NOT_FOUND_MESSAGE = (
    "Не удалось определить автомобиль по этому номеру. "
    "Проверьте VIN, госномер или Frame или заполните поля вручную."
)

_FORBIDDEN_PUBLIC_WORDS = (
    "laximo",
    "api",
    "квота",
    "лимит запросов",
    "подписка",
    "ключ",
    "401",
    "e_accessdenied",
)


def _utc_today() -> date:
    return datetime.now(timezone.utc).date()


def reset_daily_counter_if_needed(row: SiteLaximoCatIntegration) -> None:
    today = _utc_today()
    if row.requests_day != today:
        row.requests_today = 0
        row.requests_day = today
        row.quota_exhausted_at = None
    if getattr(row, "doc_requests_day", None) != today:
        row.doc_requests_today = 0
        row.doc_requests_day = today
        row.doc_quota_exhausted_at = None
    if getattr(row, "product_card_requests_day", None) != today:
        row.product_card_requests_today = 0
        row.product_card_requests_day = today
        row.product_card_quota_exhausted_at = None


def credentials_configured(row: SiteLaximoCatIntegration) -> bool:
    return bool((row.login_encrypted or "").strip() and (row.password_encrypted or "").strip())


def doc_credentials_configured(row: SiteLaximoCatIntegration) -> bool:
    return bool(
        (getattr(row, "doc_login_encrypted", None) or "").strip()
        and (getattr(row, "doc_password_encrypted", None) or "").strip()
    )


def get_plain_credentials(row: SiteLaximoCatIntegration) -> tuple[Optional[str], Optional[str]]:
    login = None
    password = None
    if (row.login_encrypted or "").strip():
        try:
            login = decrypt_laximo_secret(row.login_encrypted.strip())
        except Exception:
            login = None
    if (row.password_encrypted or "").strip():
        try:
            password = decrypt_laximo_secret(row.password_encrypted.strip())
        except Exception:
            password = None
    return login, password


def get_plain_doc_credentials(row: SiteLaximoCatIntegration) -> tuple[Optional[str], Optional[str]]:
    login = None
    password = None
    if (getattr(row, "doc_login_encrypted", None) or "").strip():
        try:
            login = decrypt_laximo_secret(row.doc_login_encrypted.strip())
        except Exception:
            login = None
    if (getattr(row, "doc_password_encrypted", None) or "").strip():
        try:
            password = decrypt_laximo_secret(row.doc_password_encrypted.strip())
        except Exception:
            password = None
    return login, password


def quota_exhausted(row: SiteLaximoCatIntegration) -> bool:
    reset_daily_counter_if_needed(row)
    limit = int(row.daily_request_limit or 0)
    if limit <= 0:
        return False
    return int(row.requests_today or 0) >= limit


def doc_quota_exhausted(row: SiteLaximoCatIntegration) -> bool:
    reset_daily_counter_if_needed(row)
    limit = int(row.daily_request_limit or 0)
    if limit <= 0:
        return False
    return int(getattr(row, "doc_requests_today", 0) or 0) >= limit


def requests_remaining(row: SiteLaximoCatIntegration) -> Optional[int]:
    reset_daily_counter_if_needed(row)
    limit = int(row.daily_request_limit or 0)
    if limit <= 0:
        return None
    used = int(row.requests_today or 0)
    return max(0, limit - used)


def doc_requests_remaining(row: SiteLaximoCatIntegration) -> Optional[int]:
    reset_daily_counter_if_needed(row)
    limit = int(row.daily_request_limit or 0)
    if limit <= 0:
        return None
    used = int(getattr(row, "doc_requests_today", 0) or 0)
    return max(0, limit - used)


def product_card_quota_exhausted(row: SiteLaximoCatIntegration) -> bool:
    reset_daily_counter_if_needed(row)
    limit = int(getattr(row, "product_card_daily_request_limit", 0) or 0)
    if limit <= 0:
        return False
    return int(getattr(row, "product_card_requests_today", 0) or 0) >= limit


def product_card_requests_remaining(row: SiteLaximoCatIntegration) -> Optional[int]:
    reset_daily_counter_if_needed(row)
    limit = int(getattr(row, "product_card_daily_request_limit", 0) or 0)
    if limit <= 0:
        return None
    used = int(getattr(row, "product_card_requests_today", 0) or 0)
    return max(0, limit - used)


def try_reserve_product_card_request(
    db: Session, row: Optional[SiteLaximoCatIntegration] = None
) -> bool:
    """Reserve one product-card HTTP slot. Returns False when daily budget exhausted."""
    integration = row or get_or_create_laximo_cat_integration(db)
    reset_daily_counter_if_needed(integration)
    limit = int(getattr(integration, "product_card_daily_request_limit", 0) or 0)
    if limit <= 0:
        return True
    used = int(getattr(integration, "product_card_requests_today", 0) or 0)
    if used >= limit:
        integration.product_card_quota_exhausted_at = datetime.now(timezone.utc)
        db.add(integration)
        db.commit()
        return False
    integration.product_card_requests_today = used + 1
    integration.product_card_requests_day = _utc_today()
    if integration.product_card_requests_today >= limit:
        integration.product_card_quota_exhausted_at = datetime.now(timezone.utc)
    db.add(integration)
    db.commit()
    db.refresh(integration)
    return True


def get_internal_status(db: Session, row: Optional[SiteLaximoCatIntegration] = None) -> str:
    integration = row or get_or_create_laximo_cat_integration(db)
    if not credentials_configured(integration):
        return INTERNAL_NOT_CONFIGURED
    if not bool(integration.last_test_ok):
        return INTERNAL_NOT_VERIFIED
    if not bool(integration.is_enabled):
        return INTERNAL_DISABLED
    if quota_exhausted(integration):
        return INTERNAL_QUOTA_EXHAUSTED
    return INTERNAL_READY


def laximo_cat_ready(db: Session, row: Optional[SiteLaximoCatIntegration] = None) -> bool:
    return get_internal_status(db, row) == INTERNAL_READY


def get_doc_internal_status(db: Session, row: Optional[SiteLaximoCatIntegration] = None) -> str:
    integration = row or get_or_create_laximo_cat_integration(db)
    if not doc_credentials_configured(integration):
        return INTERNAL_NOT_CONFIGURED
    if not bool(getattr(integration, "doc_last_test_ok", False)):
        return INTERNAL_NOT_VERIFIED
    if not bool(getattr(integration, "doc_is_enabled", False)):
        return INTERNAL_DISABLED
    if doc_quota_exhausted(integration):
        return INTERNAL_QUOTA_EXHAUSTED
    return INTERNAL_READY


def laximo_doc_ready(db: Session, row: Optional[SiteLaximoCatIntegration] = None) -> bool:
    return get_doc_internal_status(db, row) == INTERNAL_READY


def map_to_public_reason(internal: str) -> str:
    if internal == INTERNAL_NOT_FOUND:
        return PUBLIC_NOT_FOUND
    if internal == INTERNAL_READY:
        return PUBLIC_OK
    return PUBLIC_TEMPORARILY_UNAVAILABLE


def public_message_for_reason(reason: str) -> tuple[str, str]:
    if reason == PUBLIC_NOT_FOUND:
        return PUBLIC_NOT_FOUND_TITLE, PUBLIC_NOT_FOUND_MESSAGE
    return PUBLIC_UNAVAILABLE_TITLE, PUBLIC_UNAVAILABLE_MESSAGE


def assert_public_message_safe(text: str) -> bool:
    lowered = (text or "").lower()
    return not any(word in lowered for word in _FORBIDDEN_PUBLIC_WORDS)


def increment_laximo_request_counter(db: Session, row: Optional[SiteLaximoCatIntegration] = None) -> None:
    """Count one product outbound CAT call (not admin test)."""
    integration = row or get_or_create_laximo_cat_integration(db)
    reset_daily_counter_if_needed(integration)
    integration.requests_today = int(integration.requests_today or 0) + 1
    integration.requests_day = _utc_today()
    limit = int(integration.daily_request_limit or 0)
    if limit > 0 and integration.requests_today >= limit:
        integration.quota_exhausted_at = datetime.now(timezone.utc)
    db.add(integration)
    db.commit()
    db.refresh(integration)


def reset_verification_on_credential_change(row: SiteLaximoCatIntegration) -> None:
    row.last_test_ok = False
    row.is_enabled = False
    row.last_test_error = None
    row.last_test_catalogs_count = None
    row.last_tested_at = None


def reset_doc_verification_on_credential_change(row: SiteLaximoCatIntegration) -> None:
    row.doc_last_test_ok = False
    row.doc_is_enabled = False
    row.doc_last_test_error = None
    row.doc_last_tested_at = None


def reset_quota_counter(db: Session, row: Optional[SiteLaximoCatIntegration] = None) -> SiteLaximoCatIntegration:
    integration = row or get_or_create_laximo_cat_integration(db)
    integration.requests_today = 0
    integration.requests_day = _utc_today()
    integration.quota_exhausted_at = None
    db.add(integration)
    db.commit()
    db.refresh(integration)
    return integration


def increment_laximo_doc_request_counter(
    db: Session, row: Optional[SiteLaximoCatIntegration] = None
) -> None:
    """Count one product outbound DOC call (not admin test)."""
    integration = row or get_or_create_laximo_cat_integration(db)
    reset_daily_counter_if_needed(integration)
    integration.doc_requests_today = int(getattr(integration, "doc_requests_today", 0) or 0) + 1
    integration.doc_requests_day = _utc_today()
    limit = int(integration.daily_request_limit or 0)
    if limit > 0 and integration.doc_requests_today >= limit:
        integration.doc_quota_exhausted_at = datetime.now(timezone.utc)
    db.add(integration)
    db.commit()
    db.refresh(integration)


def reset_doc_quota_counter(
    db: Session, row: Optional[SiteLaximoCatIntegration] = None
) -> SiteLaximoCatIntegration:
    integration = row or get_or_create_laximo_cat_integration(db)
    integration.doc_requests_today = 0
    integration.doc_requests_day = _utc_today()
    integration.doc_quota_exhausted_at = None
    db.add(integration)
    db.commit()
    db.refresh(integration)
    return integration


def reset_product_card_quota_counter(
    db: Session, row: Optional[SiteLaximoCatIntegration] = None
) -> SiteLaximoCatIntegration:
    integration = row or get_or_create_laximo_cat_integration(db)
    integration.product_card_requests_today = 0
    integration.product_card_requests_day = _utc_today()
    integration.product_card_quota_exhausted_at = None
    db.add(integration)
    db.commit()
    db.refresh(integration)
    return integration


def record_upstream_error(db: Session, message: str, row: Optional[SiteLaximoCatIntegration] = None) -> None:
    integration = row or get_or_create_laximo_cat_integration(db)
    safe = (message or "").strip()[:2000]
    integration.last_upstream_error = safe or "upstream error"
    integration.last_upstream_error_at = datetime.now(timezone.utc)
    db.add(integration)
    db.commit()


def record_doc_upstream_error(
    db: Session, message: str, row: Optional[SiteLaximoCatIntegration] = None
) -> None:
    integration = row or get_or_create_laximo_cat_integration(db)
    safe = (message or "").strip()[:2000]
    integration.doc_last_upstream_error = safe or "upstream error"
    integration.doc_last_upstream_error_at = datetime.now(timezone.utc)
    db.add(integration)
    db.commit()
