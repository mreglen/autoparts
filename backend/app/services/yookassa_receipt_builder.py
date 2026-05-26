"""Сборка объекта receipt (54-ФЗ) для API ЮKassa."""
from __future__ import annotations

import re
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from app.core.config import settings


def _format_money(value: float | Decimal) -> str:
    quantized = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return f"{quantized:.2f}"


def normalize_phone_for_receipt(phone: str) -> str | None:
    digits = re.sub(r"\D", "", phone or "")
    if not digits:
        return None
    if digits.startswith("8") and len(digits) == 11:
        digits = "7" + digits[1:]
    if len(digits) == 10:
        digits = "7" + digits
    if len(digits) == 11 and digits.startswith("7"):
        return f"+{digits}"
    return None


def build_receipt(
    *,
    customer_email: str | None,
    customer_phone: str | None,
    cart_items: list[dict[str, Any]],
) -> dict[str, Any]:
    """cart_items: brand, partnumber, name, quantity, price."""
    items: list[dict[str, Any]] = []
    for row in cart_items:
        qty = int(row.get("quantity") or 1)
        unit_price = float(row.get("price") or 0)
        if qty <= 0 or unit_price <= 0:
            continue
        name = (row.get("name") or "").strip()
        brand = (row.get("brand") or "").strip()
        article = (row.get("partnumber") or "").strip()
        description = name or f"{brand} {article}".strip() or "Автозапчасть"
        description = description[:128]
        items.append(
            {
                "description": description,
                "quantity": f"{qty:.3f}",
                "amount": {
                    "value": _format_money(unit_price),
                    "currency": "RUB",
                },
                "vat_code": settings.YOOKASSA_DEFAULT_VAT_CODE,
                "payment_mode": "full_payment",
                "payment_subject": "commodity",
            }
        )

    if not items:
        raise ValueError("Нет позиций для чека")

    customer: dict[str, str] = {}
    email = (customer_email or "").strip()
    if email:
        customer["email"] = email
    phone = normalize_phone_for_receipt(customer_phone or "")
    if phone:
        customer["phone"] = phone
    if not customer:
        raise ValueError("Для чека нужен email или телефон покупателя")

    return {
        "customer": customer,
        "items": items,
        "tax_system_code": settings.YOOKASSA_TAX_SYSTEM_CODE,
    }
