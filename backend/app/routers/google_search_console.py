from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin_user
from app.core.config import settings
from app.db.database import get_db
from app.models.google_oauth_state import GoogleOAuthState
from app.models.site_google_integration import SiteGoogleIntegration
from app.models.user import User
from app.services.audit_service import log_audit
from app.services.google_search_console_service import (
    GoogleApiError,
    GoogleTokens,
    exchange_code_for_tokens,
    get_plain_client_secret,
    get_valid_access_token,
    list_sites,
    oauth_authorize_url,
    save_tokens,
)
from app.utils.google_integration_db import get_or_create_google_integration
from app.utils.yandex_crypto import encrypt_secret

router = APIRouter(prefix="/admin/google", tags=["Admin Google Search Console"])


class GoogleCredentialsPayload(BaseModel):
    client_id: str = Field(..., min_length=3, max_length=255)
    client_secret: Optional[str] = Field(None, max_length=2048)


class GoogleSitePayload(BaseModel):
    site_url: str = Field(..., min_length=4, max_length=1024)


class GoogleIntegrationView(BaseModel):
    connected: bool
    client_id: Optional[str] = None
    client_secret_configured: bool
    token_expires_at: Optional[datetime] = None
    site_url: Optional[str] = None
    oauth_connected_at: Optional[datetime] = None
    last_token_refresh_at: Optional[datetime] = None


def _integration_view(row: SiteGoogleIntegration) -> GoogleIntegrationView:
    return GoogleIntegrationView(
        connected=bool(row.access_token_encrypted),
        client_id=row.client_id,
        client_secret_configured=bool(row.client_secret_encrypted),
        token_expires_at=row.token_expires_at,
        site_url=row.site_url,
        oauth_connected_at=row.oauth_connected_at,
        last_token_refresh_at=row.last_token_refresh_at,
    )


@router.get("/integration", response_model=GoogleIntegrationView)
def get_google_integration(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    return _integration_view(get_or_create_google_integration(db))


@router.post("/credentials", response_model=GoogleIntegrationView)
def save_google_credentials(
    payload: GoogleCredentialsPayload,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_google_integration(db)
    row.client_id = payload.client_id.strip()
    if payload.client_secret and payload.client_secret.strip():
        row.client_secret_encrypted = encrypt_secret(payload.client_secret.strip())
    db.add(row)
    db.commit()
    db.refresh(row)
    log_audit(
        db,
        event_type="google_credentials_updated",
        category="settings",
        summary="Обновлены OAuth credentials Google Search Console",
        user=current_user,
    )
    return _integration_view(row)


@router.get("/oauth/start")
def google_oauth_start(
    redirect_to: Optional[str] = Query(None),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_google_integration(db)
    if not row.client_id:
        raise HTTPException(status_code=400, detail="Сначала сохраните client_id Google")
    state_value = secrets.token_urlsafe(32)
    state_row = GoogleOAuthState(
        state=state_value,
        created_by_user_id=current_user.id,
        redirect_to=(redirect_to or "/admin/analytics?tab=seo")[:512],
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
        used=False,
    )
    db.add(state_row)
    db.commit()
    return RedirectResponse(oauth_authorize_url(row.client_id, state_value), status_code=302)


@router.get("/oauth/callback")
def google_oauth_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    redirect_to = "/admin/analytics?tab=seo"
    if error:
        msg = f"OAuth error: {error} {error_description or ''}".strip()
        return RedirectResponse(f"{redirect_to}?google_error={msg}", status_code=302)
    if not code or not state:
        return RedirectResponse(f"{redirect_to}?google_error=missing_code_or_state", status_code=302)

    st = db.query(GoogleOAuthState).filter(GoogleOAuthState.state == state).first()
    if not st:
        return RedirectResponse(f"{redirect_to}?google_error=invalid_state", status_code=302)
    if st.used:
        return RedirectResponse(f"{redirect_to}?google_error=state_already_used", status_code=302)
    if st.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return RedirectResponse(f"{redirect_to}?google_error=state_expired", status_code=302)
    if st.redirect_to:
        redirect_to = st.redirect_to

    row = get_or_create_google_integration(db)
    client_id = (row.client_id or "").strip()
    client_secret = get_plain_client_secret(row) if row.client_secret_encrypted else None
    if not client_id or not client_secret:
        return RedirectResponse(f"{redirect_to}?google_error=missing_client_credentials", status_code=302)

    try:
        tokens = exchange_code_for_tokens(client_id, client_secret, code)
        save_tokens(db, row, tokens)
        row.oauth_connected_at = datetime.now(timezone.utc)
        db.add(row)
        st.used = True
        db.add(st)
        db.commit()
    except Exception as exc:  # noqa: BLE001
        return RedirectResponse(f"{redirect_to}?google_error=token_exchange_failed:{exc}", status_code=302)

    return RedirectResponse(f"{redirect_to}?google_connected=1", status_code=302)


@router.post("/oauth/disconnect", response_model=GoogleIntegrationView)
def google_oauth_disconnect(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_google_integration(db)
    row.access_token_encrypted = None
    row.refresh_token_encrypted = None
    row.token_expires_at = None
    db.add(row)
    db.commit()
    db.refresh(row)
    log_audit(
        db,
        event_type="google_oauth_disconnected",
        category="settings",
        summary="Отключена OAuth интеграция Google Search Console",
        user=current_user,
    )
    return _integration_view(row)


@router.post("/site", response_model=GoogleIntegrationView)
def save_google_site(
    payload: GoogleSitePayload,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_google_integration(db)
    row.site_url = payload.site_url.strip()
    db.add(row)
    db.commit()
    db.refresh(row)
    log_audit(
        db,
        event_type="google_site_url_updated",
        category="settings",
        summary=f"Указан site_url GSC: {row.site_url}",
        user=current_user,
    )
    return _integration_view(row)


@router.get("/sites")
def list_google_sites(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    row = get_or_create_google_integration(db)
    if not row.access_token_encrypted:
        raise HTTPException(status_code=400, detail="Сначала подключите OAuth Google")
    try:
        token = get_valid_access_token(db, row)
        return list_sites(token)
    except GoogleApiError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
