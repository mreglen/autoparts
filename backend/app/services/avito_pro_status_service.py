from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.organization_avito_integration import OrganizationAvitoIntegration
from app.schemas.avito_integration import AvitoAccountStatusResponse, AvitoFeatureStatus
from app.services import avito_api as avito_api_svc
from app.services.avito_api import AVITO_BASE
from app.utils.avito_crypto import decrypt_secret

logger = logging.getLogger(__name__)

PRO_CHECK_CACHE_HOURS = 6
PRO_INACTIVE_MESSAGE = "Подписка Avito Pro истекла или нет доступа к API Avito"
CREDENTIALS_ERROR_MESSAGE = "Проверьте client_id и client_secret интеграции Авито"

ACCESS_DENIED_PATTERN = re.compile(
    r"access\s*denied|forbidden|subscription|подписк|нет\s+доступа|scope|permission",
    re.I,
)


@dataclass
class _ProbeResult:
    available: bool
    status_code: Optional[int] = None
    reason: Optional[str] = None
    transient: bool = False
    credentials_error: bool = False


def _json_loads(raw: str | None, default: Any) -> Any:
    if not raw:
        return default
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return default


def _integration_row(db: Session, org_id: str) -> OrganizationAvitoIntegration | None:
    return (
        db.query(OrganizationAvitoIntegration)
        .filter(OrganizationAvitoIntegration.organization_id == org_id)
        .first()
    )


def _credentials_configured(row: OrganizationAvitoIntegration | None) -> bool:
    return bool(
        row
        and row.client_id
        and row.client_secret_encrypted
        and row.avito_user_id
    )


def _integration_enabled(row: OrganizationAvitoIntegration | None) -> bool:
    return bool(_credentials_configured(row) and row.enabled)


def _classify_http(status_code: int, body: str = "") -> _ProbeResult:
    if status_code in (200, 201, 204):
        return _ProbeResult(available=True, status_code=status_code)
    if status_code == 404:
        return _ProbeResult(available=True, status_code=status_code, reason="not_found_ok")
    if status_code == 403 or (status_code in (402, 451) and ACCESS_DENIED_PATTERN.search(body)):
        return _ProbeResult(
            available=False,
            status_code=status_code,
            reason=PRO_INACTIVE_MESSAGE,
        )
    if status_code == 401:
        return _ProbeResult(
            available=False,
            status_code=status_code,
            reason=CREDENTIALS_ERROR_MESSAGE,
            credentials_error=True,
        )
    if status_code >= 500 or status_code == 429:
        return _ProbeResult(
            available=False,
            status_code=status_code,
            reason=f"Временная ошибка Avito API (HTTP {status_code})",
            transient=True,
        )
    if ACCESS_DENIED_PATTERN.search(body):
        return _ProbeResult(
            available=False,
            status_code=status_code,
            reason=PRO_INACTIVE_MESSAGE,
        )
    return _ProbeResult(
        available=False,
        status_code=status_code,
        reason=f"Неожиданный ответ Avito API (HTTP {status_code})",
        transient=True,
    )


async def _probe_autoload(access_token: str, user_id: int) -> _ProbeResult:
    url = f"{AVITO_BASE}/autoload/v1/accounts/{user_id}/reports/last_report/"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers={"Authorization": f"Bearer {access_token}"})
            return _classify_http(response.status_code, response.text[:2000])
    except (httpx.TimeoutException, httpx.RequestError) as exc:
        logger.warning("Avito autoload probe failed: %s", exc)
        return _ProbeResult(available=False, reason=str(exc), transient=True)


async def _probe_orders(access_token: str) -> _ProbeResult:
    url = f"{AVITO_BASE}/order-management/1/orders"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                url,
                params={"limit": 1},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            return _classify_http(response.status_code, response.text[:2000])
    except (httpx.TimeoutException, httpx.RequestError) as exc:
        logger.warning("Avito orders probe failed: %s", exc)
        return _ProbeResult(available=False, reason=str(exc), transient=True)


async def _probe_messenger(access_token: str, user_id: int) -> _ProbeResult:
    url = f"{AVITO_BASE}/messenger/v3/accounts/{user_id}/chats/"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                url,
                params={"limit": 1},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if response.status_code in (404, 405):
                url_v2 = f"{AVITO_BASE}/messenger/v2/accounts/{user_id}/chats"
                response = await client.get(
                    url_v2,
                    params={"limit": 1},
                    headers={"Authorization": f"Bearer {access_token}"},
                )
            return _classify_http(response.status_code, response.text[:2000])
    except (httpx.TimeoutException, httpx.RequestError) as exc:
        logger.warning("Avito messenger probe failed: %s", exc)
        return _ProbeResult(available=False, reason=str(exc), transient=True)


def _probe_to_feature(result: _ProbeResult) -> AvitoFeatureStatus:
    return AvitoFeatureStatus(
        available=result.available,
        reason=result.reason,
        status_code=result.status_code,
    )


def _build_response_from_row(
    row: OrganizationAvitoIntegration | None,
    *,
    stale: bool = False,
) -> AvitoAccountStatusResponse:
    configured = _credentials_configured(row)
    enabled = _integration_enabled(row)
    features_raw = _json_loads(row.pro_features_json if row else None, {})
    features = {
        key: AvitoFeatureStatus(**value)
        for key, value in features_raw.items()
        if isinstance(value, dict)
    }
    return AvitoAccountStatusResponse(
        integration_enabled=enabled,
        credentials_configured=configured,
        pro_active=bool(row.pro_active) if row else True,
        pro_status_message=row.pro_status_message if row else None,
        pro_status_checked_at=(
            row.pro_status_checked_at.isoformat() if row and row.pro_status_checked_at else None
        ),
        stale=stale,
        features=features,
    )


def is_avito_pro_active(db: Session, org_id: str) -> bool:
    row = _integration_row(db, org_id)
    if not _integration_enabled(row):
        return False
    return bool(row.pro_active)


def ensure_avito_pro_active(db: Session, org_id: str) -> None:
    row = _integration_row(db, org_id)
    if not _integration_enabled(row):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Интеграция Авито не настроена",
        )
    if not row.pro_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=row.pro_status_message or PRO_INACTIVE_MESSAGE,
        )


def _should_refresh(checked_at: datetime | None, *, force: bool) -> bool:
    if force:
        return True
    if checked_at is None:
        return True
    now = datetime.now(tz=timezone.utc)
    checked = checked_at if checked_at.tzinfo else checked_at.replace(tzinfo=timezone.utc)
    return now - checked >= timedelta(hours=PRO_CHECK_CACHE_HOURS)


async def check_and_persist_avito_pro_status(
    db: Session,
    org_id: str,
    *,
    force: bool = False,
) -> AvitoAccountStatusResponse:
    row = _integration_row(db, org_id)
    if not _credentials_configured(row):
        return AvitoAccountStatusResponse(
            integration_enabled=False,
            credentials_configured=False,
            pro_active=False,
            pro_status_message=None,
            features={},
        )

    if not _should_refresh(row.pro_status_checked_at, force=force):
        return _build_response_from_row(row, stale=False)

    try:
        secret = decrypt_secret(row.client_secret_encrypted)
        token = await avito_api_svc.fetch_access_token(row.client_id, secret)
    except Exception as exc:
        logger.warning("Avito token fetch failed for org %s: %s", org_id, exc)
        return _build_response_from_row(row, stale=True)

    user_id = int(row.avito_user_id)
    autoload = await _probe_autoload(token, user_id)
    orders = await _probe_orders(token)
    messenger = await _probe_messenger(token, user_id)
    probes = {
        "autoload": autoload,
        "orders": orders,
        "messenger": messenger,
    }

    if any(p.transient for p in probes.values()):
        return _build_response_from_row(row, stale=True)

    if any(p.credentials_error for p in probes.values()):
        row.pro_status_checked_at = datetime.now(tz=timezone.utc)
        row.pro_status_message = CREDENTIALS_ERROR_MESSAGE
        row.pro_features_json = json.dumps(
            {name: _probe_to_feature(result).model_dump() for name, result in probes.items()},
            ensure_ascii=False,
        )
        db.commit()
        db.refresh(row)
        return _build_response_from_row(row, stale=False)

    pro_active = all(p.available for p in probes.values())
    if not pro_active:
        failed = [p for p in probes.values() if not p.available]
        message = failed[0].reason or PRO_INACTIVE_MESSAGE
    else:
        message = None

    row.pro_active = pro_active
    row.pro_status_message = message
    row.pro_status_checked_at = datetime.now(tz=timezone.utc)
    row.pro_features_json = json.dumps(
        {name: _probe_to_feature(result).model_dump() for name, result in probes.items()},
        ensure_ascii=False,
    )
    db.commit()
    db.refresh(row)
    return _build_response_from_row(row, stale=False)
