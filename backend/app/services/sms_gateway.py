"""Диспетчер SMS-шлюзов: выбор провайдера по site_settings.sms_provider."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.sms_message import SmsMessage
from app.utils.site_settings_db import get_or_create_site_settings

PROVIDER_SMSC = "smsc"
PROVIDER_SMSGOLD = "smsgold"


def current_sms_provider(db: Session) -> str:
    settings = get_or_create_site_settings(db)
    provider = (getattr(settings, "sms_provider", None) or PROVIDER_SMSGOLD).strip()
    return provider if provider in (PROVIDER_SMSC, PROVIDER_SMSGOLD) else PROVIDER_SMSGOLD


def send_sms(
    db: Session,
    phone: str,
    text: str,
    *,
    organization_id: str | None = None,
    inspection_booking_id: int | None = None,
    user_id: int | None = None,
) -> SmsMessage:
    if current_sms_provider(db) == PROVIDER_SMSC:
        from app.services.smsc_client import send_smsc_sms

        return send_smsc_sms(
            db,
            phone,
            text,
            organization_id=organization_id,
            inspection_booking_id=inspection_booking_id,
            user_id=user_id,
        )
    from app.services.smsgold_client import send_smsgold_sms

    return send_smsgold_sms(
        db,
        phone,
        text,
        organization_id=organization_id,
        inspection_booking_id=inspection_booking_id,
        user_id=user_id,
    )
