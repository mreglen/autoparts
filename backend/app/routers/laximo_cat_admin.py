from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin_user
from app.db.database import get_db
from app.models.site_laximo_cat_integration import (
    DEFAULT_LAXIMO_CAT_BASE_URL,
    SiteLaximoCatIntegration,
)
from app.models.user import User
from app.services.audit_service import log_audit
from app.services.laximo.cat_client import LaximoCatError, list_catalogs
from app.services.laximo.doc_client import DOC_TEST_OEM, LaximoDocError, find_oem
from app.services.laximo.gate import (
    credentials_configured,
    doc_credentials_configured,
    doc_quota_exhausted,
    doc_requests_remaining,
    get_doc_internal_status,
    get_internal_status,
    quota_exhausted,
    requests_remaining,
    reset_daily_counter_if_needed,
    reset_doc_quota_counter,
    reset_doc_verification_on_credential_change,
    reset_quota_counter,
    reset_verification_on_credential_change,
)
from app.utils.laximo_cat_integration_db import get_or_create_laximo_cat_integration
from app.utils.laximo_crypto import encrypt_laximo_secret

router = APIRouter(prefix="/admin/laximo-cat", tags=["Admin Laximo.CAT"])


class LaximoCredentialsPayload(BaseModel):
    login: Optional[str] = Field(None, min_length=1, max_length=256)
    password: Optional[str] = Field(None, min_length=1, max_length=512)


class LaximoSettingsPatch(BaseModel):
    is_enabled: Optional[bool] = None
    base_url: Optional[str] = Field(None, min_length=8, max_length=512)
    daily_request_limit: Optional[int] = Field(None, ge=0, le=1_000_000)
    doc_is_enabled: Optional[bool] = None
    doc_base_url: Optional[str] = Field(None, min_length=8, max_length=512)


class LaximoIntegrationView(BaseModel):
    login_configured: bool
    password_configured: bool
    base_url: str
    is_enabled: bool
    last_test_ok: bool
    last_tested_at: Optional[datetime] = None
    last_test_error: Optional[str] = None
    last_test_catalogs_count: Optional[int] = None
    daily_request_limit: int
    requests_today: int
    requests_remaining: Optional[int] = None
    quota_exhausted: bool
    status: str
    last_upstream_error: Optional[str] = None
    last_upstream_error_at: Optional[datetime] = None
    doc_login_configured: bool = False
    doc_password_configured: bool = False
    doc_base_url: str = DEFAULT_LAXIMO_CAT_BASE_URL
    doc_is_enabled: bool = False
    doc_last_test_ok: bool = False
    doc_last_tested_at: Optional[datetime] = None
    doc_last_test_error: Optional[str] = None
    doc_requests_today: int = 0
    doc_requests_remaining: Optional[int] = None
    doc_quota_exhausted: bool = False
    doc_status: str = "not_configured"
    doc_last_upstream_error: Optional[str] = None
    doc_last_upstream_error_at: Optional[datetime] = None


class LaximoTestResult(BaseModel):
    ok: bool
    catalogs_count: Optional[int] = None
    error: Optional[str] = None
    status: str


class LaximoDocTestResult(BaseModel):
    ok: bool
    replacements_count: Optional[int] = None
    error: Optional[str] = None
    status: str


def _integration_view(db: Session, row: SiteLaximoCatIntegration) -> LaximoIntegrationView:
    reset_daily_counter_if_needed(row)
    return LaximoIntegrationView(
        login_configured=bool((row.login_encrypted or "").strip()),
        password_configured=bool((row.password_encrypted or "").strip()),
        base_url=str(row.base_url or DEFAULT_LAXIMO_CAT_BASE_URL),
        is_enabled=bool(row.is_enabled),
        last_test_ok=bool(row.last_test_ok),
        last_tested_at=row.last_tested_at,
        last_test_error=row.last_test_error,
        last_test_catalogs_count=row.last_test_catalogs_count,
        daily_request_limit=int(row.daily_request_limit or 0),
        requests_today=int(row.requests_today or 0),
        requests_remaining=requests_remaining(row),
        quota_exhausted=quota_exhausted(row),
        status=get_internal_status(db, row),
        last_upstream_error=row.last_upstream_error,
        last_upstream_error_at=row.last_upstream_error_at,
        doc_login_configured=bool((getattr(row, "doc_login_encrypted", None) or "").strip()),
        doc_password_configured=bool((getattr(row, "doc_password_encrypted", None) or "").strip()),
        doc_base_url=str(getattr(row, "doc_base_url", None) or DEFAULT_LAXIMO_CAT_BASE_URL),
        doc_is_enabled=bool(getattr(row, "doc_is_enabled", False)),
        doc_last_test_ok=bool(getattr(row, "doc_last_test_ok", False)),
        doc_last_tested_at=getattr(row, "doc_last_tested_at", None),
        doc_last_test_error=getattr(row, "doc_last_test_error", None),
        doc_requests_today=int(getattr(row, "doc_requests_today", 0) or 0),
        doc_requests_remaining=doc_requests_remaining(row),
        doc_quota_exhausted=doc_quota_exhausted(row),
        doc_status=get_doc_internal_status(db, row),
        doc_last_upstream_error=getattr(row, "doc_last_upstream_error", None),
        doc_last_upstream_error_at=getattr(row, "doc_last_upstream_error_at", None),
    )


@router.get("/integration", response_model=LaximoIntegrationView)
def get_laximo_integration(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    row = get_or_create_laximo_cat_integration(db)
    return _integration_view(db, row)


@router.post("/credentials", response_model=LaximoIntegrationView)
def save_laximo_credentials(
    payload: LaximoCredentialsPayload,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_laximo_cat_integration(db)
    login = (payload.login or "").strip()
    password = (payload.password or "").strip()
    if not login and not password:
        raise HTTPException(status_code=400, detail="Укажите логин и/или пароль")

    changed = False
    if login:
        row.login_encrypted = encrypt_laximo_secret(login)
        changed = True
    if password:
        row.password_encrypted = encrypt_laximo_secret(password)
        changed = True

    if changed:
        reset_verification_on_credential_change(row)

    db.add(row)
    db.commit()
    db.refresh(row)
    log_audit(
        db,
        event_type="laximo_cat_credentials_updated",
        category="settings",
        summary="Обновлены учётные данные Laximo.CAT",
        user=current_user,
    )
    return _integration_view(db, row)


@router.patch("/settings", response_model=LaximoIntegrationView)
def patch_laximo_settings(
    payload: LaximoSettingsPatch,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_laximo_cat_integration(db)
    data = payload.dict(exclude_unset=True)

    if "base_url" in data and data["base_url"]:
        base = str(data["base_url"]).strip().rstrip("/")
        if not base.startswith("https://"):
            raise HTTPException(status_code=400, detail="base_url должен начинаться с https://")
        row.base_url = base

    if "daily_request_limit" in data and data["daily_request_limit"] is not None:
        row.daily_request_limit = int(data["daily_request_limit"])

    if "is_enabled" in data:
        want_enabled = bool(data["is_enabled"])
        if want_enabled:
            if not credentials_configured(row):
                raise HTTPException(status_code=400, detail="Сначала сохраните логин и пароль")
            if not bool(row.last_test_ok):
                raise HTTPException(status_code=400, detail="Сначала успешно проверьте API")
            if quota_exhausted(row):
                raise HTTPException(status_code=400, detail="Дневной лимит запросов исчерпан")
        row.is_enabled = want_enabled

    if "doc_base_url" in data and data["doc_base_url"]:
        doc_base = str(data["doc_base_url"]).strip().rstrip("/")
        if not doc_base.startswith("https://"):
            raise HTTPException(status_code=400, detail="doc_base_url должен начинаться с https://")
        row.doc_base_url = doc_base

    if "doc_is_enabled" in data:
        want_doc = bool(data["doc_is_enabled"])
        if want_doc:
            if not doc_credentials_configured(row):
                raise HTTPException(status_code=400, detail="Сначала сохраните логин и пароль DOC")
            if not bool(getattr(row, "doc_last_test_ok", False)):
                raise HTTPException(status_code=400, detail="Сначала успешно проверьте DOC API")
            if doc_quota_exhausted(row):
                raise HTTPException(status_code=400, detail="Дневной лимит запросов DOC исчерпан")
        row.doc_is_enabled = want_doc

    db.add(row)
    db.commit()
    db.refresh(row)
    log_audit(
        db,
        event_type="laximo_cat_settings_updated",
        category="settings",
        summary="Обновлены настройки Laximo.CAT",
        user=current_user,
    )
    return _integration_view(db, row)


@router.post("/doc/credentials", response_model=LaximoIntegrationView)
def save_laximo_doc_credentials(
    payload: LaximoCredentialsPayload,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_laximo_cat_integration(db)
    login = (payload.login or "").strip()
    password = (payload.password or "").strip()
    if not login and not password:
        raise HTTPException(status_code=400, detail="Укажите логин и/или пароль DOC")

    changed = False
    if login:
        row.doc_login_encrypted = encrypt_laximo_secret(login)
        changed = True
    if password:
        row.doc_password_encrypted = encrypt_laximo_secret(password)
        changed = True

    if changed:
        reset_doc_verification_on_credential_change(row)

    db.add(row)
    db.commit()
    db.refresh(row)
    log_audit(
        db,
        event_type="laximo_doc_credentials_updated",
        category="settings",
        summary="Обновлены учётные данные Laximo.DOC",
        user=current_user,
    )
    return _integration_view(db, row)


@router.post("/doc/test", response_model=LaximoDocTestResult)
def test_laximo_doc_connection(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_laximo_cat_integration(db)
    if not doc_credentials_configured(row):
        raise HTTPException(status_code=400, detail="Логин и пароль DOC не настроены")

    try:
        replacements = find_oem(
            db,
            DOC_TEST_OEM,
            count_toward_quota=False,
            use_cache=False,
        )
        count = len(replacements)
        row.doc_last_test_ok = True
        row.doc_last_test_error = None
        row.doc_last_tested_at = datetime.now(timezone.utc)
        db.add(row)
        db.commit()
        db.refresh(row)
        log_audit(
            db,
            event_type="laximo_doc_test_ok",
            category="settings",
            summary=f"Проверка Laximo.DOC успешна (FindOEM, {count} замен)",
            user=current_user,
        )
        return LaximoDocTestResult(
            ok=True,
            replacements_count=count,
            status=get_doc_internal_status(db, row),
        )
    except LaximoDocError as exc:
        row.doc_last_test_ok = False
        row.doc_is_enabled = False
        row.doc_last_test_error = exc.message
        row.doc_last_tested_at = datetime.now(timezone.utc)
        db.add(row)
        db.commit()
        db.refresh(row)
        log_audit(
            db,
            event_type="laximo_doc_test_failed",
            category="settings",
            summary="Проверка Laximo.DOC не удалась",
            user=current_user,
        )
        return LaximoDocTestResult(
            ok=False,
            error=exc.message,
            status=get_doc_internal_status(db, row),
        )


@router.post("/doc/quota/reset", response_model=LaximoIntegrationView)
def reset_laximo_doc_quota(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = reset_doc_quota_counter(db)
    log_audit(
        db,
        event_type="laximo_doc_quota_reset",
        category="settings",
        summary="Сброшен дневной счётчик запросов Laximo.DOC",
        user=current_user,
    )
    return _integration_view(db, row)


@router.post("/test", response_model=LaximoTestResult)
def test_laximo_connection(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_laximo_cat_integration(db)
    if not credentials_configured(row):
        raise HTTPException(status_code=400, detail="Логин и пароль не настроены")

    try:
        catalogs = list_catalogs(db, count_toward_quota=False)
        count = len(catalogs)
        row.last_test_ok = True
        row.last_test_error = None
        row.last_test_catalogs_count = count
        row.last_tested_at = datetime.now(timezone.utc)
        db.add(row)
        db.commit()
        db.refresh(row)
        log_audit(
            db,
            event_type="laximo_cat_test_ok",
            category="settings",
            summary=f"Проверка Laximo.CAT успешна ({count} каталогов)",
            user=current_user,
        )
        return LaximoTestResult(
            ok=True,
            catalogs_count=count,
            status=get_internal_status(db, row),
        )
    except LaximoCatError as exc:
        row.last_test_ok = False
        row.is_enabled = False
        row.last_test_error = exc.message
        row.last_tested_at = datetime.now(timezone.utc)
        db.add(row)
        db.commit()
        db.refresh(row)
        log_audit(
            db,
            event_type="laximo_cat_test_failed",
            category="settings",
            summary="Проверка Laximo.CAT не удалась",
            user=current_user,
        )
        return LaximoTestResult(
            ok=False,
            error=exc.message,
            status=get_internal_status(db, row),
        )


@router.post("/quota/reset", response_model=LaximoIntegrationView)
def reset_laximo_quota(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = reset_quota_counter(db)
    log_audit(
        db,
        event_type="laximo_cat_quota_reset",
        category="settings",
        summary="Сброшен дневной счётчик запросов Laximo.CAT",
        user=current_user,
    )
    return _integration_view(db, row)
