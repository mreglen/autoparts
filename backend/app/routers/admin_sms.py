"""Админка SMS (SMS Gold): настройки кредов + история отправок с ценами."""
from datetime import date, datetime, time
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin_user
from app.db.database import get_db
from app.models.sms_message import SmsMessage
from app.models.user import User
from app.schemas.sms import (
    SmsHistoryResponse,
    SmsMessageView,
    SmsSettingsUpdate,
    SmsSettingsView,
)
from app.services.audit_service import log_audit
from app.services.sms_gateway import PROVIDER_SMSC, PROVIDER_SMSGOLD
from app.utils.site_settings_db import get_or_create_site_settings

router = APIRouter(prefix="/admin/sms", tags=["Admin SMS"])


def _settings_view(row) -> SmsSettingsView:
    return SmsSettingsView(
        provider=(row.sms_provider or PROVIDER_SMSGOLD),
        smsc_login=(row.smsc_login or ""),
        smsc_configured=bool((row.smsc_login or "").strip() and (row.smsc_password or "").strip()),
        smsgold_user=(row.smsgold_user or ""),
        smsgold_sender=(row.smsgold_sender or ""),
        smsgold_configured=bool(
            (row.smsgold_user or "").strip() and (row.smsgold_password or "").strip()
        ),
    )


@router.get("/settings", response_model=SmsSettingsView)
def get_sms_settings(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    return _settings_view(get_or_create_site_settings(db))


@router.put("/settings", response_model=SmsSettingsView)
def put_sms_settings(
    payload: SmsSettingsUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_site_settings(db)
    if payload.provider in (PROVIDER_SMSC, PROVIDER_SMSGOLD):
        row.sms_provider = payload.provider
    if payload.smsc_login is not None:
        row.smsc_login = payload.smsc_login.strip() or None
    if payload.smsc_password and payload.smsc_password.strip():
        row.smsc_password = payload.smsc_password.strip()
    if payload.smsgold_user is not None:
        row.smsgold_user = payload.smsgold_user.strip() or None
    if payload.smsgold_password and payload.smsgold_password.strip():
        row.smsgold_password = payload.smsgold_password.strip()
    if payload.smsgold_sender is not None:
        row.smsgold_sender = payload.smsgold_sender.strip() or None
    if not row.smsc_login:
        row.smsc_password = None
    if not row.smsgold_user:
        row.smsgold_password = None
    db.commit()
    log_audit(
        db,
        event_type="sms_settings_updated",
        category="settings",
        summary="Настройки SMS-шлюза обновлены",
        user=current_user,
        details={"provider": row.sms_provider},
    )
    return _settings_view(row)


@router.get("/history", response_model=SmsHistoryResponse)
def get_sms_history(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    limit: int = Query(default=500, ge=1, le=2000),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    query = db.query(SmsMessage)
    if date_from:
        query = query.filter(SmsMessage.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        query = query.filter(SmsMessage.created_at <= datetime.combine(date_to, time.max))

    total_cost = (
        query.with_entities(func.coalesce(func.sum(SmsMessage.cost), 0))
        .filter(SmsMessage.status == "sent")
        .scalar()
    ) or Decimal(0)

    items = query.order_by(SmsMessage.created_at.desc(), SmsMessage.id.desc()).limit(limit).all()

    return SmsHistoryResponse(
        items=[SmsMessageView.model_validate(item) for item in items],
        count=len(items),
        total_cost=total_cost,
    )
