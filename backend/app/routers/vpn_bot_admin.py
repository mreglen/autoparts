from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin_user
from app.db.database import get_db
from app.models.user import User
from app.services.audit_service import log_audit
from app.services.vpn_bot_service import apply_vpn_bot_runtime, get_plain_bot_token, normalize_bot_token
from app.utils.vpn_bot_crypto import encrypt_vpn_bot_secret
from app.utils.vpn_bot_integration_db import get_or_create_vpn_bot_integration

router = APIRouter(prefix="/admin/vpn-bot", tags=["Admin VPN Bot"])


class VpnBotCredentialsPayload(BaseModel):
    bot_token: str = Field(..., min_length=20, max_length=256)


class VpnBotSettingsPatch(BaseModel):
    is_enabled: Optional[bool] = None


class VpnBotIntegrationView(BaseModel):
    is_enabled: bool
    bot_token_configured: bool
    applied: bool = False
    service_active: bool = False
    last_apply_status: Optional[str] = None


def _view(row, *, applied: bool = False, service_active: bool = False) -> VpnBotIntegrationView:
    return VpnBotIntegrationView(
        is_enabled=bool(row.is_enabled),
        bot_token_configured=bool(row.bot_token_encrypted),
        applied=applied,
        service_active=service_active,
        last_apply_status=row.last_apply_status,
    )


@router.get("/integration", response_model=VpnBotIntegrationView)
def get_vpn_bot_integration(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    return _view(get_or_create_vpn_bot_integration(db))


@router.post("/credentials", response_model=VpnBotIntegrationView)
def save_vpn_bot_credentials(
    payload: VpnBotCredentialsPayload,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    try:
        token = normalize_bot_token(payload.bot_token)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    row = get_or_create_vpn_bot_integration(db)
    row.bot_token_encrypted = encrypt_vpn_bot_secret(token)
    # Сохранение токена сразу включает бота и применяет runtime
    row.is_enabled = True
    result = apply_vpn_bot_runtime(token=token, enabled=True)
    row.last_apply_status = result.get("message")
    db.add(row)
    db.commit()
    db.refresh(row)

    log_audit(
        db,
        event_type="vpn_bot_credentials_updated",
        category="settings",
        summary="Обновлён токен Telegram VPN-бота",
        user=current_user,
    )
    return _view(
        row,
        applied=bool(result.get("applied")),
        service_active=bool(result.get("service_active")),
    )


@router.patch("/settings", response_model=VpnBotIntegrationView)
def patch_vpn_bot_settings(
    payload: VpnBotSettingsPatch,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_vpn_bot_integration(db)
    data = payload.dict(exclude_unset=True)
    if "is_enabled" in data:
        row.is_enabled = bool(data["is_enabled"])

    token = get_plain_bot_token(row)
    if row.is_enabled and not token:
        raise HTTPException(status_code=400, detail="Сначала сохраните токен бота")

    result = apply_vpn_bot_runtime(token=token, enabled=bool(row.is_enabled))
    row.last_apply_status = result.get("message")
    db.add(row)
    db.commit()
    db.refresh(row)

    log_audit(
        db,
        event_type="vpn_bot_settings_updated",
        category="settings",
        summary=f"VPN-бот: {'вкл' if row.is_enabled else 'выкл'}",
        user=current_user,
    )
    return _view(
        row,
        applied=bool(result.get("applied")),
        service_active=bool(result.get("service_active")),
    )


@router.post("/apply", response_model=VpnBotIntegrationView)
def reapply_vpn_bot(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    row = get_or_create_vpn_bot_integration(db)
    token = get_plain_bot_token(row)
    if row.is_enabled and not token:
        raise HTTPException(status_code=400, detail="Токен бота не настроен")
    result = apply_vpn_bot_runtime(token=token, enabled=bool(row.is_enabled and token))
    row.last_apply_status = result.get("message")
    db.add(row)
    db.commit()
    db.refresh(row)
    return _view(
        row,
        applied=bool(result.get("applied")),
        service_active=bool(result.get("service_active")),
    )
