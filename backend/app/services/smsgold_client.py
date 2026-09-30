"""SMS Gold gateway client + отправка с записью в sms_messages."""
from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from decimal import Decimal, InvalidOperation

import requests
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.sms_message import SmsMessage
from app.utils.site_settings_db import get_or_create_site_settings

logger = logging.getLogger(__name__)

SMSGOLD_URL = "https://web.smsgold.ru/http2/"
SMSGOLD_TIMEOUT_SECONDS = 15


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


def get_smsgold_credentials(db: Session) -> tuple[str, str, str | None]:
    settings = get_or_create_site_settings(db)
    user = (getattr(settings, "smsgold_user", None) or "").strip()
    password = (getattr(settings, "smsgold_password", None) or "").strip()
    sender = (getattr(settings, "smsgold_sender", None) or "").strip() or None
    if not user or not password:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SMS-шлюз не настроен (задайте ID и пароль SMS Gold в админке)",
        )
    return user, password, sender


def _smsgold_request(params: dict) -> str:
    resp = requests.post(
        SMSGOLD_URL,
        data=params,
        timeout=SMSGOLD_TIMEOUT_SECONDS,
    )
    resp.raise_for_status()
    return resp.text


def _smsgold_balance(user: str, password: str) -> Decimal | None:
    try:
        body = _smsgold_request({"user": user, "pass": password, "action": "balance"})
        root = ET.fromstring(body)
        node = root.find(".//result/account")
        if node is not None and node.text:
            return Decimal(node.text.strip())
    except Exception:
        logger.exception("SMSGold balance request failed")
    return None


def _parse_send_response(body: str) -> tuple[str | None, str | None]:
    """Возвращает (sms_id, error)."""
    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        return None, f"Неожиданный ответ SMS Gold: {body[:200]}"
    xml_result = root.find("xml_result")
    if xml_result is not None:
        err = (xml_result.get("err") or "").strip()
        if err and err != "0":
            return None, f"SMS Gold: {err}"
    sms = root.find(".//sms")
    if sms is None:
        return None, f"Неожиданный ответ SMS Gold: {body[:200]}"
    err = (sms.get("err") or "").strip()
    if err and err != "0":
        return None, f"SMS Gold: {err}"
    return sms.get("sms_id"), None


def send_smsgold_sms(
    db: Session,
    phone: str,
    text: str,
    *,
    organization_id: str | None = None,
    inspection_booking_id: int | None = None,
    user_id: int | None = None,
) -> SmsMessage:
    """Send SMS via SMS Gold and always log the attempt to sms_messages."""
    phone_digits = normalize_phone_for_sms(phone)
    log = SmsMessage(
        organization_id=organization_id,
        inspection_booking_id=inspection_booking_id,
        phone=phone_digits or (phone or "")[:40],
        text=text[:2000],
        provider="smsgold",
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
        user, password, sender = get_smsgold_credentials(db)
        balance_before = _smsgold_balance(user, password)
        params = {
            "user": user,
            "pass": password,
            "action": "send",
            "number": phone_digits,
            "text": text,
        }
        if sender:
            params["sender"] = sender
        body = _smsgold_request(params)
        sms_id, error = _parse_send_response(body)
        if error:
            log.error_message = error
        else:
            log.status = "sent"
            log.provider_message_id = (sms_id or "")[:64] or None
            balance_after = _smsgold_balance(user, password)
            if balance_before is not None and balance_after is not None:
                cost = balance_before - balance_after
                if cost > 0:
                    log.cost = cost
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("SMSGold send failed")
        log.error_message = f"SMS Gold недоступен: {exc}"

    db.add(log)
    db.flush()
    return log
