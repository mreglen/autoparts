"""HTTP-клиент ЮKassa (REST API v3, без SDK)."""
from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)


class YookassaClient:
    def __init__(self) -> None:
        if not settings.yookassa_configured:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="ЮKassa не настроена: укажите YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY в .env",
            )
        self._base = settings.YOOKASSA_API_BASE.rstrip("/")
        self._auth = httpx.BasicAuth(
            settings.YOOKASSA_SHOP_ID or "",
            settings.yookassa_secret_key or "",
        )

    async def create_payment(self, payload: dict[str, Any], idempotence_key: str) -> dict[str, Any]:
        return await self._request(
            "POST",
            "/payments",
            json_body=payload,
            idempotence_key=idempotence_key,
        )

    async def get_payment(self, payment_id: str) -> dict[str, Any]:
        return await self._request("GET", f"/payments/{payment_id}")

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json_body: dict[str, Any] | None = None,
        idempotence_key: str | None = None,
    ) -> dict[str, Any]:
        headers = {"Content-Type": "application/json"}
        if idempotence_key:
            headers["Idempotence-Key"] = idempotence_key

        url = f"{self._base}{path}"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.request(
                    method,
                    url,
                    auth=self._auth,
                    headers=headers,
                    json=json_body,
                )
        except httpx.HTTPError as exc:
            logger.exception("YooKassa HTTP error: %s %s", method, path)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Ошибка связи с платёжным сервисом",
            ) from exc

        if response.status_code >= 400:
            logger.warning(
                "YooKassa API error %s %s: %s",
                response.status_code,
                path,
                response.text[:500],
            )
            detail = "Ошибка платёжного сервиса"
            try:
                body = response.json()
                if isinstance(body, dict):
                    desc = body.get("description") or body.get("type")
                    if desc:
                        detail = str(desc)
            except Exception:
                pass
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=detail,
            )

        data = response.json()
        if not isinstance(data, dict):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Некорректный ответ платёжного сервиса",
            )
        return data


def get_yookassa_client() -> YookassaClient:
    return YookassaClient()
