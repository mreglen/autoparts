"""Helpers to match garage orders with organization clients."""
from __future__ import annotations

from typing import Any, Optional

from app.utils.phone import normalize_to_storage_format


def buyer_key(email: str | None, phone: str | None) -> tuple[str, str] | None:
    normalized_phone = normalize_to_storage_format(phone or "")
    email_norm = (email or "").strip().lower()
    if not email_norm and not normalized_phone:
        return None
    return (email_norm, normalized_phone or "")


def parse_buyer_name(buyer_name: str | None) -> tuple[str, str, Optional[str]]:
    parts = [p for p in (buyer_name or "").strip().split() if p]
    if not parts:
        return "", "", None
    if len(parts) == 1:
        return parts[0], "", None
    if len(parts) == 2:
        return parts[0], parts[1], None
    return parts[0], parts[1], " ".join(parts[2:])


def order_matches_buyer(order, email: str, phone: str) -> bool:
    order_email = (order.buyer_email or "").strip().lower()
    target_email = (email or "").strip().lower()
    if order_email != target_email:
        return False
    order_phone = normalize_to_storage_format(order.buyer_phone or "")
    target_phone = normalize_to_storage_format(phone or "")
    return order_phone == target_phone


def merge_buyer_from_order(buyers: dict[tuple[str, str], dict[str, Any]], order) -> None:
    key = buyer_key(order.buyer_email, order.buyer_phone)
    if not key:
        return
    if key not in buyers:
        last_name, first_name, patronymic = parse_buyer_name(order.buyer_name)
        buyers[key] = {
            "id": None,
            "last_name": last_name,
            "first_name": first_name,
            "patronymic": patronymic,
            "email": (order.buyer_email or "").strip(),
            "phone": normalize_to_storage_format(order.buyer_phone or "") or (order.buyer_phone or ""),
            "orders_count": 0,
        }
    buyers[key]["orders_count"] += 1
