"""Async-клиент Marzban REST API."""

from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import Any

import httpx

from config import Settings
from happ_crypto import encode_happ_crypt4

logger = logging.getLogger("marzban-vpn-bot.marzban")


class MarzbanClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._token: str | None = None
        self._token_expires_at: float = 0.0
        self._client = httpx.AsyncClient(
            base_url=settings.marzban_base_url,
            timeout=30.0,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _get_token(self) -> str:
        now = time.time()
        if self._token and now < self._token_expires_at:
            return self._token

        response = await self._client.post(
            "/api/admin/token",
            data={
                "username": self._settings.marzban_username,
                "password": self._settings.marzban_password,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if response.status_code != 200:
            logger.error(
                "Ошибка токена Marzban: %s %s",
                response.status_code,
                response.text,
            )
            raise RuntimeError(
                f"Не удалось авторизоваться в Marzban (HTTP {response.status_code})"
            )

        access_token = response.json().get("access_token")
        if not access_token:
            raise RuntimeError("Marzban не вернул access_token")

        self._token = access_token
        self._token_expires_at = now + 50 * 60
        return access_token

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json_body: dict[str, Any] | None = None,
    ) -> httpx.Response:
        token = await self._get_token()
        response = await self._client.request(
            method,
            path,
            json=json_body,
            headers={"Authorization": f"Bearer {token}"},
        )
        if response.status_code == 401:
            self._token = None
            token = await self._get_token()
            response = await self._client.request(
                method,
                path,
                json=json_body,
                headers={"Authorization": f"Bearer {token}"},
            )
        return response

    def public_subscription_url(self, url: str) -> str:
        """Panel/local → публичный HTTPS subscription.

        Happ часто отклоняет cleartext `http://IP:port/sub/...` как «невалидная подписка».
        """
        url = (url or "").strip()
        src = self._settings.subscription_url_rewrite_from
        dst = self._settings.subscription_url_rewrite_to
        if src and dst and src in url:
            url = url.replace(src, dst)
        for a, b in (
            ("://195.24.65.251:2086", "://svoygarage.ru"),
            ("://195.24.65.251:62050", "://svoygarage.ru"),
            ("http://svoygarage.ru", "https://svoygarage.ru"),
        ):
            if a in url:
                url = url.replace(a, b)
        return url

    def extract_subscription_url(self, user_payload: dict[str, Any]) -> str | None:
        url = user_payload.get("subscription_url")
        if isinstance(url, str) and url.strip():
            return self.public_subscription_url(url.strip())
        return None

    async def create_user(
        self,
        username: str,
        *,
        expire_at: datetime,
        note: str = "issued-by-telegram-bot",
    ) -> dict[str, Any]:
        data_limit_bytes = 0
        if self._settings.data_limit_gb > 0:
            data_limit_bytes = int(self._settings.data_limit_gb * (1024**3))

        expire_ts = int(expire_at.timestamp())
        body: dict[str, Any] = {
            "username": username,
            "proxies": {"vless": {"flow": "xtls-rprx-vision"}},
            "inbounds": {"vless": [self._settings.inbound_tag]},
            "expire": expire_ts,
            "data_limit": data_limit_bytes,
            "data_limit_reset_strategy": "no_reset",
            "status": "active",
            "note": note,
        }

        response = await self._request("POST", "/api/user", json_body=body)
        if response.status_code not in (200, 201):
            logger.error(
                "Ошибка создания пользователя: %s %s",
                response.status_code,
                response.text,
            )
            raise RuntimeError(
                f"Marzban отклонил создание пользователя (HTTP {response.status_code})"
            )
        return response.json()

    async def get_user(self, username: str) -> dict[str, Any] | None:
        response = await self._request("GET", f"/api/user/{username}")
        if response.status_code == 404:
            return None
        if response.status_code != 200:
            logger.error(
                "Ошибка get_user %s: %s %s",
                username,
                response.status_code,
                response.text,
            )
            raise RuntimeError(
                f"Marzban get_user failed (HTTP {response.status_code})"
            )
        return response.json()

    async def modify_user(self, username: str, patch: dict[str, Any]) -> dict[str, Any]:
        response = await self._request("PUT", f"/api/user/{username}", json_body=patch)
        if response.status_code != 200:
            logger.error(
                "Ошибка modify_user %s: %s %s",
                username,
                response.status_code,
                response.text,
            )
            raise RuntimeError(
                f"Marzban modify_user failed (HTTP {response.status_code})"
            )
        return response.json()

    async def set_expire(self, username: str, expire_at: datetime) -> dict[str, Any]:
        return await self.modify_user(
            username,
            {"expire": int(expire_at.timestamp())},
        )

    async def set_status(self, username: str, status: str) -> dict[str, Any]:
        """status: active | disabled | on_hold | limited | expired (зависит от версии)."""
        return await self.modify_user(username, {"status": status})

    async def disable_user(self, username: str) -> dict[str, Any]:
        return await self.set_status(username, "disabled")

    async def activate_user(
        self,
        username: str,
        *,
        expire_at: datetime,
    ) -> dict[str, Any]:
        return await self.modify_user(
            username,
            {
                "status": "active",
                "expire": int(expire_at.timestamp()),
            },
        )

    @staticmethod
    def expected_crypt4(subscription_url: str) -> str:
        return encode_happ_crypt4(subscription_url)
