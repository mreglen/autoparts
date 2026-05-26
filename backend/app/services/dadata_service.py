"""Прокси к API подсказок DaData (адреса)."""
from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)

DADATA_SUGGEST_URL = (
    "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address"
)

# Федеральные округа на чекауте — не названия регионов DaData.
_FEDERAL_DISTRICTS = frozenset(
    {
        "Центр",
        "Северо-Запад",
        "Юг",
        "Поволжье",
        "Урал",
        "Сибирь",
        "Дальний Восток",
        "Северный Кавказ",
    }
)


def _sanitize_locations(
    locations: list[dict[str, str]] | None,
) -> list[dict[str, str]] | None:
    if not locations:
        return [{"country": "Россия"}]

    cleaned: list[dict[str, str]] = []
    for item in locations:
        if not isinstance(item, dict):
            continue
        region = (item.get("region") or "").strip()
        if region in _FEDERAL_DISTRICTS:
            continue
        row = {k: str(v).strip() for k, v in item.items() if v is not None and str(v).strip()}
        if row:
            cleaned.append(row)

    return cleaned if cleaned else [{"country": "Россия"}]


async def suggest_address(
    query: str,
    *,
    count: int = 7,
    locations: list[dict[str, str]] | None = None,
) -> list[dict[str, Any]]:
    token = (settings.DADATA_API_KEY or "").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Подсказки адреса не настроены (DADATA_API_KEY)",
        )

    body: dict[str, Any] = {
        "query": query.strip(),
        "count": count,
        "locations": _sanitize_locations(locations),
    }

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.post(
                DADATA_SUGGEST_URL,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Authorization": f"Token {token}",
                },
                json=body,
            )
    except httpx.HTTPError as exc:
        logger.exception("DaData HTTP error")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Ошибка связи с сервисом подсказок адреса",
        ) from exc

    if response.status_code == 401:
        logger.error("DaData unauthorized — проверьте DADATA_API_KEY")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Неверный ключ DaData",
        )

    if response.status_code >= 400:
        logger.warning("DaData API %s: %s", response.status_code, response.text[:300])
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Сервис подсказок адреса вернул ошибку",
        )

    data = response.json()
    if not isinstance(data, dict):
        return []
    suggestions = data.get("suggestions")
    return suggestions if isinstance(suggestions, list) else []
