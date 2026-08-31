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


def _parse_geocode_from_suggestions(suggestions: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not suggestions:
        return None
    first = suggestions[0]
    if not isinstance(first, dict):
        return None
    data = first.get("data")
    if not isinstance(data, dict):
        return None
    lat_raw = data.get("geo_lat")
    lon_raw = data.get("geo_lon")
    if lat_raw in (None, "") or lon_raw in (None, ""):
        return None
    try:
        lat = float(lat_raw)
        lon = float(lon_raw)
    except (TypeError, ValueError):
        return None
    qc_raw = data.get("qc_geo")
    qc_geo: int | None
    try:
        qc_geo = int(qc_raw) if qc_raw not in (None, "") else None
    except (TypeError, ValueError):
        qc_geo = None
    return {"lat": lat, "lon": lon, "qc_geo": qc_geo}


async def geocode_address(address: str) -> dict[str, Any] | None:
    """Resolve coordinates for a free-form address via DaData suggest."""
    query = (address or "").strip()
    if not query:
        return None
    suggestions = await suggest_address(query, count=1)
    return _parse_geocode_from_suggestions(suggestions)


def geocode_address_sync(address: str) -> dict[str, Any] | None:
    """Sync wrapper for Celery/backfill jobs."""
    import asyncio

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            raise RuntimeError("geocode_address_sync called from running event loop")
        return loop.run_until_complete(geocode_address(address))
    except RuntimeError:
        return asyncio.run(geocode_address(address))
