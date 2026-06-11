from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote, urlencode

import requests
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.site_google_integration import SiteGoogleIntegration
from app.utils.yandex_crypto import decrypt_secret, encrypt_secret


class GoogleApiError(Exception):
    def __init__(self, message: str, *, code: str | None = None, payload: dict | None = None):
        super().__init__(message)
        self.code = code
        self.payload = payload or {}


GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"


@dataclass
class GoogleTokens:
    access_token: str
    refresh_token: str | None
    expires_at: dt.datetime | None


def _redirect_uri() -> str:
    if settings.GOOGLE_OAUTH_REDIRECT_URI:
        return settings.GOOGLE_OAUTH_REDIRECT_URI.strip()
    return f"{settings.PUBLIC_BASE_URL.rstrip('/')}/api/admin/google/oauth/callback"


def _request_json(method: str, url: str, *, token: str | None = None, **kwargs):
    headers = kwargs.pop("headers", {}) or {}
    headers["Accept"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = requests.request(method, url, headers=headers, timeout=30, **kwargs)
    payload = resp.json() if resp.content else {}
    if not resp.ok:
        message = "Google API error"
        if isinstance(payload, dict):
            message = str(payload.get("error_description") or payload.get("error") or message)
        raise GoogleApiError(f"{message} (HTTP {resp.status_code})", payload=payload if isinstance(payload, dict) else None)
    return payload if isinstance(payload, dict) else {}


def oauth_authorize_url(client_id: str, state: str) -> str:
    q = urlencode(
        {
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": _redirect_uri(),
            "scope": GSC_SCOPE,
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
    )
    return f"{settings.GOOGLE_OAUTH_AUTHORIZE_URL}?{q}"


def exchange_code_for_tokens(client_id: str, client_secret: str, code: str) -> GoogleTokens:
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": _redirect_uri(),
    }
    payload = _request_json("POST", settings.GOOGLE_OAUTH_TOKEN_URL, data=data)
    access = str(payload.get("access_token") or "").strip()
    if not access:
        raise GoogleApiError("Не получен access_token от Google")
    refresh = payload.get("refresh_token")
    expires_in = payload.get("expires_in")
    expires_at = None
    if expires_in is not None:
        try:
            expires_at = dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=int(expires_in))
        except Exception:
            expires_at = None
    return GoogleTokens(access_token=access, refresh_token=refresh, expires_at=expires_at)


def refresh_access_token(client_id: str, client_secret: str, refresh_token: str) -> GoogleTokens:
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": client_id,
        "client_secret": client_secret,
    }
    payload = _request_json("POST", settings.GOOGLE_OAUTH_TOKEN_URL, data=data)
    access = str(payload.get("access_token") or "").strip()
    if not access:
        raise GoogleApiError("Не получен access_token при обновлении токена Google")
    expires_in = payload.get("expires_in")
    expires_at = None
    if expires_in is not None:
        try:
            expires_at = dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=int(expires_in))
        except Exception:
            expires_at = None
    return GoogleTokens(access_token=access, refresh_token=refresh_token, expires_at=expires_at)


def get_plain_client_secret(integration: SiteGoogleIntegration) -> str | None:
    if not integration.client_secret_encrypted:
        return None
    try:
        return decrypt_secret(integration.client_secret_encrypted)
    except Exception as exc:
        raise GoogleApiError("Не удалось расшифровать client_secret Google") from exc


def save_tokens(db: Session, integration: SiteGoogleIntegration, tokens: GoogleTokens) -> None:
    integration.access_token_encrypted = encrypt_secret(tokens.access_token)
    if tokens.refresh_token:
        integration.refresh_token_encrypted = encrypt_secret(tokens.refresh_token)
    integration.token_expires_at = tokens.expires_at
    integration.last_token_refresh_at = dt.datetime.now(dt.timezone.utc)
    db.add(integration)
    db.commit()
    db.refresh(integration)


def get_valid_access_token(db: Session, integration: SiteGoogleIntegration) -> str:
    if not integration.access_token_encrypted:
        raise GoogleApiError("OAuth токен Google не подключен")
    access_token = decrypt_secret(integration.access_token_encrypted)
    expires_at = integration.token_expires_at
    now = dt.datetime.now(dt.timezone.utc)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=dt.timezone.utc)
    if expires_at and expires_at <= now + dt.timedelta(minutes=2):
        refresh_encrypted = integration.refresh_token_encrypted
        if not refresh_encrypted:
            raise GoogleApiError("OAuth токен Google истек, refresh_token отсутствует")
        client_id = (integration.client_id or "").strip()
        client_secret = get_plain_client_secret(integration)
        if not client_id or not client_secret:
            raise GoogleApiError("Не заполнены client_id/client_secret Google")
        refresh_token = decrypt_secret(refresh_encrypted)
        refreshed = refresh_access_token(client_id, client_secret, refresh_token)
        save_tokens(db, integration, refreshed)
        access_token = refreshed.access_token
    return access_token


def list_sites(token: str) -> dict:
    return _request_json("GET", "https://www.googleapis.com/webmasters/v3/sites", token=token)


def search_analytics_query(
    token: str,
    site_url: str,
    *,
    start_date: str,
    end_date: str,
    dimensions: list[str] | None = None,
    row_limit: int = 250,
) -> dict:
    encoded_site = quote(site_url, safe="")
    body: dict[str, Any] = {
        "startDate": start_date,
        "endDate": end_date,
        "rowLimit": max(1, min(row_limit, 25000)),
    }
    if dimensions:
        body["dimensions"] = dimensions
    return _request_json(
        "POST",
        f"https://www.googleapis.com/webmasters/v3/sites/{encoded_site}/searchAnalytics/query",
        token=token,
        json=body,
    )
