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
    SmsGoldSettingsUpdate,
    SmsGoldSettingsView,
    SmsHistoryResponse,
    SmsMessageView,
)
from app.services.audit_service import log_audit
from app.utils.site_settings_db import get_or_create_site_settings

router = APIRouter(prefix="/admin/sms", tags=["Admin SMS"])


@router.get("/settings", response_model=SmsGoldSettingsView)
def get_sms_settings(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_site_settings(db)
    return SmsGoldSettingsView(
        user=(row.smsgold_user or ""),
        sender=(row.smsgold_sender or ""),
        configured=bool((row.smsgold_user or "").strip() and (row.smsgold_password or "").strip()),
    )


@router.put("/settings", response_model=SmsGoldSettingsView)
def put_sms_settings(
    payload: SmsGoldSettingsUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_site_settings(db)
    row.smsgold_user = payload.user.strip() or None
    row.smsgold_sender = (payload.sender or "").strip() or None
    if payload.password and payload.password.strip():
        row.smsgold_password = payload.password.strip()
    if not row.smsgold_user:
        row.smsgold_password = None
    db.commit()
    log_audit(
        db,
        event_type="sms_settings_updated",
        category="settings",
        summary="Настройки SMS Gold обновлены",
        user=current_user,
        details={"user": row.smsgold_user, "sender": row.smsgold_sender},
    )
    return SmsGoldSettingsView(
        user=(row.smsgold_user or ""),
        sender=(row.smsgold_sender or ""),
        configured=bool(row.smsgold_user and row.smsgold_password),
    )


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
