"""Pickup code / QR verification for marketplace garage orders."""
from __future__ import annotations

import hashlib
import json
import secrets
from base64 import urlsafe_b64encode
from datetime import datetime, timedelta, timezone
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException, status

from app.core.config import settings

PICKUP_READY_STATUS = "ready_for_pickup"
NEW_PICKUP_READY_STATUS = "new_ready_for_pickup"
PICKUP_DELIVERED_STATUS = "delivered"
NEW_PICKUP_DELIVERED_STATUS = "new_received"

MAX_VERIFY_ATTEMPTS = 5
CODE_TTL_DAYS = 14
QR_KIND = "pickup"


def _fernet() -> Fernet:
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    return Fernet(urlsafe_b64encode(digest))


def generate_pickup_code() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(6))


def hash_pickup_code(code: str) -> str:
    normalized = str(code or "").strip()
    raw = f"{settings.SECRET_KEY}:pickup:{normalized}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def encrypt_pickup_code(code: str) -> str:
    return _fernet().encrypt(str(code).encode("utf-8")).decode("utf-8")


def decrypt_pickup_code(cipher: str | None) -> str | None:
    if not cipher:
        return None
    try:
        return _fernet().decrypt(cipher.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError):
        return None


def build_qr_payload(*, order_id: int, code: str, order_kind: str = "used") -> str:
    return json.dumps(
        {"v": 1, "k": QR_KIND, "kind": order_kind, "o": int(order_id), "c": str(code)},
        separators=(",", ":"),
    )


def parse_qr_payload(raw: str | None) -> dict[str, Any] | None:
    if not raw or not str(raw).strip():
        return None
    text = str(raw).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict) or data.get("k") != QR_KIND:
        return None
    return data


def is_pickup_delivery(order: Any) -> bool:
    return str(getattr(order, "delivery_type", "") or "").strip().lower() == "pickup"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def ensure_pickup_code(order: Any, *, order_kind: str = "used", force_new: bool = False) -> str:
    """Create or return active pickup code plaintext for an order."""
    existing = None if force_new else decrypt_pickup_code(getattr(order, "pickup_code_cipher", None))
    expires_at = getattr(order, "pickup_code_expires_at", None)
    if existing and expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if existing and expires_at and expires_at > utcnow() and not getattr(order, "pickup_verified_at", None):
        return existing

    code = generate_pickup_code()
    now = utcnow()
    order.pickup_code_hash = hash_pickup_code(code)
    order.pickup_code_cipher = encrypt_pickup_code(code)
    order.pickup_code_created_at = now
    order.pickup_code_expires_at = now + timedelta(days=CODE_TTL_DAYS)
    order.pickup_verify_attempts = 0
    order.pickup_verified_at = None
    # bind unused kind for callers that need QR later
    order._pickup_order_kind = order_kind  # type: ignore[attr-defined]
    return code


def get_buyer_pickup_payload(order: Any, *, order_kind: str) -> dict[str, str | None]:
    ready = (
        NEW_PICKUP_READY_STATUS
        if order_kind == "new"
        else PICKUP_READY_STATUS
    )
    if getattr(order, "status_code", None) != ready:
        return {"pickup_code": None, "pickup_qr_payload": None}
    if getattr(order, "pickup_verified_at", None):
        return {"pickup_code": None, "pickup_qr_payload": None}
    code = decrypt_pickup_code(getattr(order, "pickup_code_cipher", None))
    if not code:
        return {"pickup_code": None, "pickup_qr_payload": None}
    expires_at = getattr(order, "pickup_code_expires_at", None)
    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= utcnow():
            return {"pickup_code": None, "pickup_qr_payload": None}
    return {
        "pickup_code": code,
        "pickup_qr_payload": build_qr_payload(
            order_id=int(order.id),
            code=code,
            order_kind=order_kind,
        ),
    }


def block_direct_pickup_delivery(
    order: Any,
    *,
    new_status: str,
    order_kind: str = "used",
) -> None:
    """Block direct delivered transition for pickup orders (use verify/override)."""
    if not is_pickup_delivery(order):
        return
    delivered = NEW_PICKUP_DELIVERED_STATUS if order_kind == "new" else PICKUP_DELIVERED_STATUS
    if new_status != delivered:
        return
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=(
            "Для самовывоза статус «Получен» ставится только после проверки кода "
            "или через «Выдать без кода»"
        ),
    )


def verify_pickup_code(
    order: Any,
    *,
    code: str | None = None,
    qr_payload: str | None = None,
    order_kind: str = "used",
) -> str:
    """
    Validate code/QR. On success marks verified and returns delivered status code.
    Raises HTTPException on failure.
    """
    ready = NEW_PICKUP_READY_STATUS if order_kind == "new" else PICKUP_READY_STATUS
    delivered = NEW_PICKUP_DELIVERED_STATUS if order_kind == "new" else PICKUP_DELIVERED_STATUS

    if getattr(order, "status_code", None) != ready:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Заказ не в статусе «готов к выдаче»",
        )
    if getattr(order, "pickup_verified_at", None):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Заказ уже выдан")

    attempts = int(getattr(order, "pickup_verify_attempts", 0) or 0)
    if attempts >= MAX_VERIFY_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много попыток. Обновите код: снова поставьте «К выдаче»",
        )

    expires_at = getattr(order, "pickup_code_expires_at", None)
    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= utcnow():
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Код истёк. Обновите выдачу")

    resolved_code = (code or "").strip()
    if qr_payload and not resolved_code:
        parsed = parse_qr_payload(qr_payload)
        if not parsed:
            order.pickup_verify_attempts = attempts + 1
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Некорректный QR")
        if int(parsed.get("o") or 0) != int(order.id):
            order.pickup_verify_attempts = attempts + 1
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="QR от другого заказа")
        resolved_code = str(parsed.get("c") or "").strip()

    if not resolved_code or not resolved_code.isdigit() or len(resolved_code) != 6:
        order.pickup_verify_attempts = attempts + 1
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Введите 6-значный код")

    expected_hash = getattr(order, "pickup_code_hash", None)
    if not expected_hash or hash_pickup_code(resolved_code) != expected_hash:
        order.pickup_verify_attempts = attempts + 1
        remaining = MAX_VERIFY_ATTEMPTS - int(order.pickup_verify_attempts or 0)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Неверный код. Осталось попыток: {max(0, remaining)}",
        )

    order.pickup_verified_at = utcnow()
    order.pickup_verify_attempts = attempts
    return delivered


def apply_pickup_override(order: Any, *, order_kind: str = "used") -> str:
    ready = NEW_PICKUP_READY_STATUS if order_kind == "new" else PICKUP_READY_STATUS
    delivered = NEW_PICKUP_DELIVERED_STATUS if order_kind == "new" else PICKUP_DELIVERED_STATUS
    current = getattr(order, "status_code", None)
    if current == delivered:
        return delivered
    if current != ready and not is_pickup_delivery(order):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Override доступен только для самовывоза в статусе «готов к выдаче»",
        )
    if current != ready:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Сначала поставьте статус «К выдаче»",
        )
    order.pickup_verified_at = utcnow()
    return delivered
