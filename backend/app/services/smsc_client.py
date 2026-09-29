"""SMSC.ru SMS gateway client + отправка с записью в sms_messages."""
from __future__ import annotations

import logging
from decimal import Decimal, InvalidOperation

import requests
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.sms_message import SmsMessage
from app.utils.site_settings_db import get_or_create_site_settings

logger = logging.getLogger(__name__)

SMSC_SEND_URL = "https://smsc.ru/sys/send.php"
SMSC_TIMEOUT_SECONDS = 15


def normalize_phone_for_sms(phone: str | None) -> str | None:
    """+7 (999) 123-45-67 -> 79991234567; 8 -> 7."""
    if not phone:
        return None
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]
    if len(digits) == 10:
        digits = "7" + digits
    if len(digits) != 11 or not digits.startswith("7"):
        return None
    return digits


def get_smsc_credentials(db: Session) -> tuple[str, str]:
    settings = get_or_create_site_settings(db)
    login = (getattr(settings, "smsc_login", None) or "").strip()
    password = (getattr(settings, "smsc_password", None) or "").strip()
    if not login or not password:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SMS-шлюз не настроен (задайте логин и пароль SMSC в админке)",
        )
    return login, password


def _smsc_send(phone_digits: str, text: str, login: str, password: str) -> dict:
    resp = requests.post(
        SMSC_SEND_URL,
        data={
            "login": login,
            "psw": password,
            "phones": phone_digits,
            "mes": text,
            "fmt": 3,
            "cost": 3,
            "charset": "utf-8",
        },
        timeout=SMSC_TIMEOUT_SECONDS,
    )
    resp.raise_for_status()
    return resp.json()


def send_smsc_sms(
    db: Session,
    phone: str,
    text: str,
    *,
    organization_id: str | None = None,
    inspection_booking_id: int | None = None,
    user_id: int | None = None,
) -> SmsMessage:
    """Send SMS via SMSC and always log the attempt to sms_messages."""
    phone_digits = normalize_phone_for_sms(phone)
    log = SmsMessage(
        organization_id=organization_id,
        inspection_booking_id=inspection_booking_id,
        phone=phone_digits or (phone or "")[:40],
        text=text[:2000],
        status="error",
        created_by_user_id=user_id,
    )
    if not phone_digits:
        log.error_message = "Некорректный номер телефона"
        db.add(log)
        db.flush()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректный номер телефона для SMS",
        )

    try:
        login, password = get_smsc_credentials(db)
        data = _smsc_send(phone_digits, text, login, password)
        if "error" in data:
            log.error_message = f"SMSC: {data.get('error')} (code {data.get('error_code')})"
        else:
            log.status = "sent"
            log.provider_message_id = str(data.get("id") or "")[:64] or None
            try:
                log.cost = Decimal(str(data.get("cost")))
            except (InvalidOperation, TypeError):
                log.cost = None
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("SMSC send failed")
        log.error_message = f"SMSC недоступен: {exc}"

    db.add(log)
    db.flush()
    return log
