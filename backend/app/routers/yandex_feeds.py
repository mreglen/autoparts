from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlparse

import requests
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin_user
from app.core.config import settings
from app.db.database import get_db
from app.models.site_yandex_integration import SiteYandexIntegration
from app.models.yandex_oauth_state import YandexOAuthState
from app.models.user import User
from app.services.audit_service import log_audit
from app.services.site_delivery_service import region_ids_csv_from_delivery
from app.services.yandex_feed_sync_service import (
    build_public_feed_url,
    mark_yandex_feed_dirty,
    normalize_feed_type,
    normalize_region_ids_csv,
    parse_region_ids_csv,
)
from app.services.yandex_feed_xml_service import generate_used_yml_feed
from app.services.yandex_webmaster_service import (
    YandexApiError,
    YandexTokens,
    add_host,
    exchange_code_for_tokens,
    feeds_list,
    get_host_verification,
    get_user,
    get_valid_access_token,
    get_plain_client_secret,
    list_hosts,
    oauth_authorize_url,
    save_tokens,
)
from app.tasks.yandex_feed_tasks import run_yandex_feed_sync
from app.utils.yandex_crypto import encrypt_secret
from app.utils.yandex_integration_db import (
    get_or_create_yandex_feed_sync_state,
    get_or_create_yandex_integration,
)

router = APIRouter(prefix="/admin/yandex", tags=["Admin Yandex feeds"])


def _host_name_only(url_or_host: str) -> str:
    value = (url_or_host or "").strip()
    if not value:
        return ""
    if "://" not in value:
        value = f"https://{value}"
    parsed = urlparse(value)
    host = (parsed.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    return host


class YandexCredentialsPayload(BaseModel):
    client_id: str = Field(..., min_length=3, max_length=255)
    client_secret: Optional[str] = Field(None, max_length=2048)


class YandexFeedSettingsPayload(BaseModel):
    feed_type: str = "GOODS"
    region_ids_csv: str = "225"
    used_condition_type: str = "preowned"
    used_condition_reason: str = "Товар бывший в употреблении, проверен продавцом"
    event_driven_enabled: bool = True
    debounce_seconds: int = Field(300, ge=30, le=3600)
    control_sync_interval_minutes: int = Field(720, ge=30, le=10080)
    enabled: bool = True


class YandexHostEnsurePayload(BaseModel):
    host_url: str = "https://svoygarage.ru"


class YandexManualTokenPayload(BaseModel):
    access_token: str = Field(..., min_length=10, max_length=4096)


class YandexVerificationCodePayload(BaseModel):
    code: str = Field(..., min_length=3, max_length=512)
    host_url: str = "https://svoygarage.ru"


class YandexEnableSetupPayload(BaseModel):
    host_url: str = "https://svoygarage.ru"
    trigger_sync: bool = True


class YandexIntegrationView(BaseModel):
    connected: bool
    client_id: Optional[str] = None
    client_secret_configured: bool
    token_expires_at: Optional[datetime] = None
    yandex_user_id: Optional[int] = None
    host_id: Optional[str] = None
    host_url: Optional[str] = None
    feed_type: str
    region_ids_csv: str
    used_condition_type: str
    used_condition_reason: str
    event_driven_enabled: bool
    debounce_seconds: int
    control_sync_interval_minutes: int
    enabled: bool
    feed_url: str
    oauth_connected_at: Optional[datetime] = None
    last_token_refresh_at: Optional[datetime] = None


class YandexFeedSyncView(BaseModel):
    pending_sync: bool
    sync_in_progress: bool
    last_change_reason: Optional[str] = None
    last_event_at: Optional[datetime] = None
    last_enqueued_at: Optional[datetime] = None
    last_feed_url: Optional[str] = None
    last_checksum: Optional[str] = None
    last_request_id: Optional[str] = None
    last_process_status: Optional[str] = None
    last_sync_started_at: Optional[datetime] = None
    last_sync_finished_at: Optional[datetime] = None
    last_error: Optional[str] = None
    consecutive_failures: int


def _integration_view(db: Session, row: SiteYandexIntegration) -> YandexIntegrationView:
    feed_type = normalize_feed_type(row.feed_type)
    region_ids_csv = normalize_region_ids_csv(row.region_ids_csv)
    return YandexIntegrationView(
        connected=bool(row.access_token_encrypted),
        client_id=row.client_id,
        client_secret_configured=bool(row.client_secret_encrypted),
        token_expires_at=row.token_expires_at,
        yandex_user_id=row.yandex_user_id,
        host_id=row.host_id,
        host_url=row.host_url,
        feed_type=feed_type,
        region_ids_csv=region_ids_csv,
        used_condition_type=row.used_condition_type or "preowned",
        used_condition_reason=row.used_condition_reason or "Товар бывший в употреблении, проверен продавцом",
        event_driven_enabled=bool(row.event_driven_enabled),
        debounce_seconds=int(row.debounce_seconds or 300),
        control_sync_interval_minutes=int(row.control_sync_interval_minutes or 720),
        enabled=bool(row.enabled),
        feed_url=build_public_feed_url(row.host_url),
        oauth_connected_at=row.oauth_connected_at,
        last_token_refresh_at=row.last_token_refresh_at,
    )


@router.get("/integration", response_model=YandexIntegrationView)
def get_integration_state(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_yandex_integration(db)
    return _integration_view(db, row)


@router.patch("/credentials", response_model=YandexIntegrationView)
def patch_credentials(
    payload: YandexCredentialsPayload,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_yandex_integration(db)
    row.client_id = payload.client_id.strip()
    if payload.client_secret is not None and payload.client_secret.strip():
        row.client_secret_encrypted = encrypt_secret(payload.client_secret.strip())
    db.add(row)
    db.commit()
    db.refresh(row)
    log_audit(
        db,
        event_type="yandex_credentials_updated",
        category="settings",
        summary="Обновлены учетные данные Яндекс OAuth",
        user=current_user,
    )
    return _integration_view(db, row)


@router.patch("/feed-settings", response_model=YandexIntegrationView)
def patch_feed_settings(
    payload: YandexFeedSettingsPayload,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_yandex_integration(db)
    row.feed_type = normalize_feed_type(payload.feed_type)
    row.region_ids_csv = normalize_region_ids_csv(payload.region_ids_csv)
    row.used_condition_type = (payload.used_condition_type or "preowned").strip()[:32]
    row.used_condition_reason = (
        payload.used_condition_reason or "Товар бывший в употреблении, проверен продавцом"
    ).strip()[:1000]
    row.event_driven_enabled = bool(payload.event_driven_enabled)
    row.debounce_seconds = int(payload.debounce_seconds)
    row.control_sync_interval_minutes = int(payload.control_sync_interval_minutes)
    row.enabled = bool(payload.enabled)
    db.add(row)
    db.commit()
    db.refresh(row)
    log_audit(
        db,
        event_type="yandex_feed_settings_updated",
        category="settings",
        summary="Обновлены настройки YML фида Яндекс",
        user=current_user,
    )
    return _integration_view(db, row)


@router.get("/oauth/start")
def oauth_start(
    redirect_to: Optional[str] = Query(None),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_yandex_integration(db)
    if not row.client_id:
        raise HTTPException(status_code=400, detail="Сначала сохраните client_id Яндекса")
    state_value = secrets.token_urlsafe(32)
    state_row = YandexOAuthState(
        state=state_value,
        created_by_user_id=current_user.id,
        redirect_to=(redirect_to or "/admin-settings")[:512],
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
        used=False,
    )
    db.add(state_row)
    db.commit()
    return RedirectResponse(oauth_authorize_url(row.client_id, state_value), status_code=302)


@router.get("/oauth/callback")
def oauth_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    redirect_to = "/admin-settings"
    if error:
        msg = f"OAuth error: {error} {error_description or ''}".strip()
        return RedirectResponse(f"{redirect_to}?yandex_error={msg}", status_code=302)

    if not code or not state:
        return RedirectResponse(
            f"{redirect_to}?yandex_error=missing_code_or_state",
            status_code=302,
        )

    st = db.query(YandexOAuthState).filter(YandexOAuthState.state == state).first()
    if not st:
        return RedirectResponse(f"{redirect_to}?yandex_error=invalid_state", status_code=302)
    if st.used:
        return RedirectResponse(f"{redirect_to}?yandex_error=state_already_used", status_code=302)
    if st.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return RedirectResponse(f"{redirect_to}?yandex_error=state_expired", status_code=302)
    if st.redirect_to:
        redirect_to = st.redirect_to

    row = get_or_create_yandex_integration(db)
    client_id = (row.client_id or "").strip()
    client_secret = get_plain_client_secret(row) if row.client_secret_encrypted else None
    if not client_id or not client_secret:
        return RedirectResponse(
            f"{redirect_to}?yandex_error=missing_client_credentials",
            status_code=302,
        )

    try:
        tokens = exchange_code_for_tokens(client_id, client_secret, code)
        save_tokens(db, row, tokens)
        row.oauth_connected_at = datetime.now(timezone.utc)
        db.add(row)
        st.used = True
        db.add(st)
        db.commit()
    except Exception as exc:  # noqa: BLE001
        return RedirectResponse(
            f"{redirect_to}?yandex_error=token_exchange_failed:{exc}",
            status_code=302,
        )

    return RedirectResponse(f"{redirect_to}?yandex_connected=1", status_code=302)


@router.get("/oauth/authorize-url")
def oauth_authorize_url_endpoint(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_yandex_integration(db)
    client_id = (row.client_id or "").strip()
    if not client_id:
        raise HTTPException(status_code=400, detail="Сначала сохраните client_id Яндекса")
    return {
        "authorize_url": oauth_authorize_url(client_id, secrets.token_urlsafe(16)),
        "redirect_uri": (
            settings.YANDEX_OAUTH_REDIRECT_URI
            or f"{settings.PUBLIC_BASE_URL.rstrip('/')}/api/admin/yandex/oauth/callback"
        ),
    }


@router.post("/oauth/exchange-code", response_model=YandexIntegrationView)
def oauth_exchange_verification_code(
    payload: YandexVerificationCodePayload,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    code = payload.code.strip()
    if not code:
        raise HTTPException(status_code=400, detail="code обязателен")

    row = get_or_create_yandex_integration(db)
    client_id = (row.client_id or "").strip()
    client_secret = get_plain_client_secret(row) if row.client_secret_encrypted else None
    if not client_id or not client_secret:
        raise HTTPException(status_code=400, detail="Сначала сохраните client_id и client_secret")

    try:
        tokens = exchange_code_for_tokens(client_id, client_secret, code)
        save_tokens(db, row, tokens)
        row.oauth_connected_at = datetime.now(timezone.utc)
        db.add(row)
        db.commit()
        db.refresh(row)
    except YandexApiError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    host_url = (payload.host_url or "https://svoygarage.ru").strip()
    try:
        _ensure_host_bindings(db, row, host_url)
    except YandexApiError as exc:
        log_audit(
            db,
            event_type="yandex_oauth_code_exchanged",
            category="settings",
            summary="OAuth код обменян, но host_id не привязан",
            user=current_user,
        )
        return _integration_view(db, row)

    log_audit(
        db,
        event_type="yandex_oauth_code_exchanged",
        category="settings",
        summary="OAuth подключён через verification code",
        user=current_user,
    )
    return _integration_view(db, row)


@router.post("/oauth/disconnect", response_model=YandexIntegrationView)
def oauth_disconnect(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_yandex_integration(db)
    row.access_token_encrypted = None
    row.refresh_token_encrypted = None
    row.token_expires_at = None
    row.yandex_user_id = None
    db.add(row)
    db.commit()
    db.refresh(row)
    log_audit(
        db,
        event_type="yandex_oauth_disconnected",
        category="settings",
        summary="Отключена OAuth интеграция Яндекс",
        user=current_user,
    )
    return _integration_view(db, row)


def _ensure_host_bindings(
    db: Session,
    row: SiteYandexIntegration,
    target_host_url: str,
) -> dict:
    token = get_valid_access_token(db, row)
    user_payload = get_user(token)
    user_id = int(user_payload.get("user_id"))
    row.yandex_user_id = user_id

    hosts_payload = list_hosts(user_id, token)
    hosts = hosts_payload.get("hosts") or []
    target_host = _host_name_only(target_host_url)
    found = None
    for host in hosts:
        h_url = host.get("ascii_host_url") or host.get("unicode_host_url") or host.get("host_url") or ""
        if _host_name_only(h_url) == target_host:
            found = host
            break

    added = False
    if not found:
        add_payload = add_host(user_id, token, target_host_url)
        added = True
        found = {"host_id": add_payload.get("host_id"), "ascii_host_url": target_host_url}

    host_id = found.get("host_id")
    if not host_id:
        raise YandexApiError("Не удалось определить host_id после проверки/добавления сайта")

    row.host_id = str(host_id)
    row.host_url = target_host_url
    db.add(row)
    db.commit()
    db.refresh(row)

    verification = get_host_verification(user_id, row.host_id, token)
    verification_state = str(verification.get("verification_state") or "").upper()
    verified = verification_state == "VERIFIED"

    return {
        "ok": verified,
        "added": added,
        "host_id": row.host_id,
        "host_url": row.host_url,
        "user_id": row.yandex_user_id,
        "verified": verified,
        "verification_state": verification_state or None,
        "verification_type": verification.get("verification_type"),
        "verification_uin": verification.get("verification_uin"),
        "note": (
            "Сайт добавлен в Вебмастер. Подтвердите права на сайт и повторите проверку."
            if added and not verified
            else "Сайт найден в Вебмастере."
            if not added
            else "Сайт добавлен и права подтверждены."
        ),
    }


@router.post("/oauth/token", response_model=YandexIntegrationView)
def oauth_save_manual_token(
    payload: YandexManualTokenPayload,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    access_token = payload.access_token.strip()
    if not access_token:
        raise HTTPException(status_code=400, detail="access_token обязателен")

    try:
        user_payload = get_user(access_token)
        user_id = int(user_payload.get("user_id"))
    except YandexApiError as exc:
        raise HTTPException(status_code=400, detail=f"Токен недействителен: {exc}") from exc

    row = get_or_create_yandex_integration(db)
    save_tokens(
        db,
        row,
        YandexTokens(access_token=access_token, refresh_token=None, expires_at=None),
    )
    row.yandex_user_id = user_id
    row.oauth_connected_at = datetime.now(timezone.utc)
    db.add(row)
    db.commit()
    db.refresh(row)
    log_audit(
        db,
        event_type="yandex_oauth_token_saved",
        category="settings",
        summary="Сохранен OAuth access_token Яндекс вручную",
        user=current_user,
    )
    return _integration_view(db, row)


@router.get("/webmaster/status")
def get_webmaster_status(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_yandex_integration(db)
    if not row.access_token_encrypted:
        raise HTTPException(status_code=400, detail="Сначала подключите OAuth Яндекса")

    token = get_valid_access_token(db, row)
    user_payload = get_user(token)
    user_id = int(user_payload.get("user_id"))
    row.yandex_user_id = user_id
    db.commit()

    hosts_payload = list_hosts(user_id, token)
    hosts = hosts_payload.get("hosts") or []

    verification = None
    verified = False
    feeds = None
    if row.host_id:
        try:
            verification = get_host_verification(user_id, row.host_id, token)
            verified = str(verification.get("verification_state") or "").upper() == "VERIFIED"
            feeds = feeds_list(user_id=user_id, host_id=row.host_id, token=token)
        except YandexApiError as exc:
            verification = {"error": str(exc), "error_code": getattr(exc, "code", None)}

    return {
        "user_id": user_id,
        "host_id": row.host_id,
        "host_url": row.host_url,
        "enabled": bool(row.enabled),
        "connected": True,
        "verified": verified,
        "verification": verification,
        "hosts": hosts,
        "feeds": feeds,
        "feed_url": build_public_feed_url(row.host_url),
        "ready_for_sync": bool(row.host_id and verified and row.enabled),
    }


@router.post("/setup/enable")
def enable_yandex_integration(
    payload: YandexEnableSetupPayload,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_yandex_integration(db)
    if not row.access_token_encrypted:
        raise HTTPException(status_code=400, detail="Сначала подключите OAuth Яндекса")

    target_host_url = payload.host_url.strip() or "https://svoygarage.ru"
    row.enabled = True
    row.region_ids_csv = normalize_region_ids_csv(region_ids_csv_from_delivery(db))
    db.add(row)
    db.commit()

    try:
        host_result = _ensure_host_bindings(db, row, target_host_url)
    except YandexApiError as exc:
        code = getattr(exc, "code", None)
        raise HTTPException(
            status_code=400,
            detail={
                "message": str(exc),
                "error_code": code,
                "step": "host_ensure",
            },
        ) from exc

    sync_task_id = None
    if payload.trigger_sync and host_result.get("verified"):
        state = get_or_create_yandex_feed_sync_state(db)
        state.pending_sync = True
        state.last_change_reason = "setup_enable"
        state.last_enqueued_at = datetime.now(timezone.utc)
        db.add(state)
        db.commit()
        task = run_yandex_feed_sync.delay(trigger="manual", force=True)
        sync_task_id = task.id

    log_audit(
        db,
        event_type="yandex_integration_enabled",
        category="settings",
        summary="Включена интеграция Яндекс через /admin-settings",
        user=current_user,
    )

    return {
        "ok": bool(host_result.get("verified")),
        "integration_enabled": True,
        "host": host_result,
        "sync_queued": bool(sync_task_id),
        "sync_task_id": sync_task_id,
        "integration": _integration_view(db, row),
    }


@router.post("/host/ensure")
def host_ensure(
    payload: YandexHostEnsurePayload,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_yandex_integration(db)
    if not row.access_token_encrypted:
        raise HTTPException(status_code=400, detail="Сначала подключите OAuth Яндекса")

    target_host_url = payload.host_url.strip()
    if not target_host_url:
        raise HTTPException(status_code=400, detail="host_url обязателен")

    try:
        result = _ensure_host_bindings(db, row, target_host_url)
        if not result.get("verified"):
            return {
                **result,
                "ok": False,
                "error_code": "HOST_NOT_VERIFIED",
                "message": "Права на сайт не подтверждены",
                "manual_steps_url": "https://yandex.ru/dev/webmaster/doc/ru/concepts/verification",
            }
        return result
    except YandexApiError as exc:
        code = getattr(exc, "code", None)
        if code == "HOST_NOT_VERIFIED":
            return {
                "ok": False,
                "error_code": code,
                "message": str(exc),
                "manual_steps_url": "https://yandex.ru/dev/webmaster/doc/ru/concepts/verification",
            }
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/feeds/sync-status", response_model=YandexFeedSyncView)
def get_sync_status(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    state = get_or_create_yandex_feed_sync_state(db)
    return YandexFeedSyncView(
        pending_sync=bool(state.pending_sync),
        sync_in_progress=bool(state.sync_in_progress),
        last_change_reason=state.last_change_reason,
        last_event_at=state.last_event_at,
        last_enqueued_at=state.last_enqueued_at,
        last_feed_url=state.last_feed_url,
        last_checksum=state.last_checksum,
        last_request_id=state.last_request_id,
        last_process_status=state.last_process_status,
        last_sync_started_at=state.last_sync_started_at,
        last_sync_finished_at=state.last_sync_finished_at,
        last_error=state.last_error,
        consecutive_failures=int(state.consecutive_failures or 0),
    )


@router.post("/feeds/sync")
def trigger_sync(
    force: bool = Query(False),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    state = get_or_create_yandex_feed_sync_state(db)
    state.pending_sync = True
    state.last_change_reason = "manual"
    state.last_enqueued_at = datetime.now(timezone.utc)
    db.add(state)
    db.commit()
    task = run_yandex_feed_sync.delay(trigger="manual", force=force)
    return {"ok": True, "task_id": task.id, "queued": True}


@router.get("/feeds/list")
def list_uploaded_feeds(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_yandex_integration(db)
    if not row.host_id:
        raise HTTPException(status_code=400, detail="host_id не настроен")
    token = get_valid_access_token(db, row)
    user_payload = get_user(token)
    user_id = int(user_payload.get("user_id"))
    row.yandex_user_id = user_id
    db.commit()
    return feeds_list(user_id=user_id, host_id=row.host_id, token=token)


@router.get("/feeds/public-preview")
def preview_public_feed(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_yandex_integration(db)
    feed = generate_used_yml_feed(
        db,
        preferred_host_url=row.host_url,
        condition_type=row.used_condition_type,
        condition_reason=row.used_condition_reason,
    )
    return {
        "feed_url": build_public_feed_url(row.host_url),
        "offers_count": feed.offers_count,
        "categories_count": feed.categories_count,
        "new_offers_count": feed.new_offers_count,
        "used_offers_count": feed.used_offers_count,
        "checksum": feed.checksum,
    }


@router.get("/feeds/public-head-check")
def check_public_feed_head(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_yandex_integration(db)
    feed_url = build_public_feed_url(row.host_url)
    try:
        r = requests.get(feed_url, timeout=20)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Feed URL недоступен: {exc}") from exc
    return {
        "feed_url": feed_url,
        "http_status": r.status_code,
        "content_type": r.headers.get("content-type"),
        "ok": r.status_code == 200,
    }


@router.get("/oauth/debug")
def oauth_debug(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_yandex_integration(db)
    return {
        "client_id_set": bool(row.client_id),
        "secret_set": bool(row.client_secret_encrypted),
        "redirect_uri": (
            settings.YANDEX_OAUTH_REDIRECT_URI
            or f"{settings.PUBLIC_BASE_URL.rstrip('/')}/api/admin/yandex/oauth/callback"
        ),
    }


@router.get("/feeds/public-used-yml")
def deprecated_public_feed_alias(
    db: Session = Depends(get_db),
):
    # Legacy alias for diagnostics if needed.
    row = get_or_create_yandex_integration(db)
    payload = generate_used_yml_feed(
        db,
        preferred_host_url=row.host_url,
        condition_type=row.used_condition_type,
        condition_reason=row.used_condition_reason,
    )
    return Response(content=payload.xml, media_type="application/xml")


@router.post("/feeds/mark-dirty")
def manual_mark_dirty(
    reason: str = Query("manual_mark"),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    mark_yandex_feed_dirty(db, reason)
    return {"ok": True}
