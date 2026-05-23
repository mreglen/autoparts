from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from typing import Any

import requests
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.site_yandex_integration import SiteYandexIntegration
from app.utils.yandex_crypto import decrypt_secret, encrypt_secret


class YandexApiError(Exception):
    def __init__(self, message: str, *, code: str | None = None, payload: dict | None = None):
        super().__init__(message)
        self.code = code
        self.payload = payload or {}


@dataclass
class YandexTokens:
    access_token: str
    refresh_token: str | None
    expires_at: dt.datetime | None


def _api_base() -> str:
    return settings.YANDEX_WEBMASTER_API_BASE.rstrip("/")


def _redirect_uri() -> str:
    if settings.YANDEX_OAUTH_REDIRECT_URI:
        return settings.YANDEX_OAUTH_REDIRECT_URI.strip()
    return f"{settings.PUBLIC_BASE_URL.rstrip('/')}/api/admin/yandex/oauth/callback"


def _decode_error(payload: Any) -> tuple[str, str]:
    if isinstance(payload, dict):
        code = str(payload.get("error_code") or payload.get("error") or "")
        message = str(
            payload.get("error_message")
            or payload.get("error_description")
            or payload.get("message")
            or code
            or "Yandex API error"
        )
        return code, message
    return "", "Yandex API error"


def _request_json(method: str, url: str, *, token: str | None = None, **kwargs):
    headers = kwargs.pop("headers", {}) or {}
    headers["Accept"] = "application/json"
    if token:
        headers["Authorization"] = f"OAuth {token}"
    resp = requests.request(method, url, headers=headers, timeout=30, **kwargs)
    payload = resp.json() if resp.content else {}
    if not resp.ok:
        code, message = _decode_error(payload)
        raise YandexApiError(
            f"{message} (HTTP {resp.status_code})",
            code=code or None,
            payload=payload if isinstance(payload, dict) else None,
        )
    return payload if isinstance(payload, dict) else {}


def exchange_code_for_tokens(client_id: str, client_secret: str, code: str) -> YandexTokens:
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": _redirect_uri(),
    }
    payload = _request_json("POST", settings.YANDEX_OAUTH_TOKEN_URL, data=data)
    access = str(payload.get("access_token") or "").strip()
    if not access:
        raise YandexApiError("Не получен access_token от Яндекса")
    refresh = payload.get("refresh_token")
    expires_in = payload.get("expires_in")
    expires_at = None
    if expires_in is not None:
        try:
            expires_at = dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=int(expires_in))
        except Exception:
            expires_at = None
    return YandexTokens(access_token=access, refresh_token=refresh, expires_at=expires_at)


def refresh_access_token(client_id: str, client_secret: str, refresh_token: str) -> YandexTokens:
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": client_id,
        "client_secret": client_secret,
    }
    payload = _request_json("POST", settings.YANDEX_OAUTH_TOKEN_URL, data=data)
    access = str(payload.get("access_token") or "").strip()
    if not access:
        raise YandexApiError("Не получен access_token при обновлении токена")
    new_refresh = payload.get("refresh_token") or refresh_token
    expires_in = payload.get("expires_in")
    expires_at = None
    if expires_in is not None:
        try:
            expires_at = dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=int(expires_in))
        except Exception:
            expires_at = None
    return YandexTokens(access_token=access, refresh_token=new_refresh, expires_at=expires_at)


def get_plain_client_secret(integration: SiteYandexIntegration) -> str | None:
    if not integration.client_secret_encrypted:
        return None
    try:
        return decrypt_secret(integration.client_secret_encrypted)
    except Exception as exc:
        raise YandexApiError("Не удалось расшифровать client_secret Яндекса") from exc


def save_tokens(db: Session, integration: SiteYandexIntegration, tokens: YandexTokens) -> None:
    integration.access_token_encrypted = encrypt_secret(tokens.access_token)
    integration.refresh_token_encrypted = (
        encrypt_secret(tokens.refresh_token) if tokens.refresh_token else None
    )
    integration.token_expires_at = tokens.expires_at
    integration.last_token_refresh_at = dt.datetime.now(dt.timezone.utc)
    db.add(integration)
    db.commit()
    db.refresh(integration)


def get_valid_access_token(db: Session, integration: SiteYandexIntegration) -> str:
    if not integration.access_token_encrypted:
        raise YandexApiError("OAuth токен Яндекса не подключен")
    try:
        access_token = decrypt_secret(integration.access_token_encrypted)
    except Exception as exc:
        raise YandexApiError("Не удалось расшифровать access_token Яндекса") from exc

    expires_at = integration.token_expires_at
    now = dt.datetime.now(dt.timezone.utc)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=dt.timezone.utc)

    # Обновляем заранее, за 2 минуты.
    if expires_at and expires_at <= now + dt.timedelta(minutes=2):
        refresh_encrypted = integration.refresh_token_encrypted
        if not refresh_encrypted:
            raise YandexApiError("OAuth токен истек, refresh_token отсутствует")
        client_id = (integration.client_id or "").strip()
        client_secret = get_plain_client_secret(integration)
        if not client_id or not client_secret:
            raise YandexApiError("Не заполнены client_id/client_secret для обновления токена")
        try:
            refresh_token = decrypt_secret(refresh_encrypted)
        except Exception as exc:
            raise YandexApiError("Не удалось расшифровать refresh_token Яндекса") from exc
        refreshed = refresh_access_token(client_id, client_secret, refresh_token)
        save_tokens(db, integration, refreshed)
        access_token = refreshed.access_token

    return access_token


def get_user(token: str) -> dict:
    return _request_json("GET", f"{_api_base()}/user", token=token)


def list_hosts(user_id: int, token: str) -> dict:
    return _request_json("GET", f"{_api_base()}/user/{user_id}/hosts", token=token)


def get_host_verification(user_id: int, host_id: str, token: str) -> dict:
    return _request_json(
        "GET",
        f"{_api_base()}/user/{user_id}/hosts/{host_id}/verification",
        token=token,
    )


def add_host(user_id: int, token: str, host_url: str) -> dict:
    body = {"host_url": host_url}
    return _request_json("POST", f"{_api_base()}/user/{user_id}/hosts", token=token, json=body)


def feeds_add_start(
    user_id: int,
    host_id: str,
    token: str,
    *,
    feed_url: str,
    feed_type: str,
    region_ids: list[int],
) -> dict:
    body = {"feed": {"url": feed_url, "type": feed_type, "regionIds": region_ids}}
    return _request_json(
        "POST",
        f"{_api_base()}/user/{user_id}/hosts/{host_id}/feeds/add/start",
        token=token,
        json=body,
    )


def feeds_add_info(user_id: int, host_id: str, token: str, request_id: str) -> dict:
    body = {"requestId": request_id}
    return _request_json(
        "GET",
        f"{_api_base()}/user/{user_id}/hosts/{host_id}/feeds/add/info",
        token=token,
        json=body,
    )


def feeds_list(user_id: int, host_id: str, token: str) -> dict:
    return _request_json(
        "GET",
        f"{_api_base()}/user/{user_id}/hosts/{host_id}/feeds/list",
        token=token,
    )


def oauth_authorize_url(client_id: str, state: str) -> str:
    from urllib.parse import urlencode

    q = urlencode(
        {
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": _redirect_uri(),
            "state": state,
        }
    )
    return f"{settings.YANDEX_OAUTH_AUTHORIZE_URL}?{q}"
