"""Extract YooKassa payment economics fields from API payloads."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Protocol


class _EconomicsRow(Protocol):
    amount_value: float
    income_amount: float | None
    acquiring_fee_amount: float | None
    refund_amount: float | None
    refunded_at: datetime | None


def _extract_amount_value(node: Any) -> float | None:
    if node is None:
        return None
    if isinstance(node, dict):
        raw = node.get("value")
    else:
        raw = node
    if raw is None:
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    return value if value >= 0 else None


def apply_yookassa_economics(row: _EconomicsRow, api_payment: dict[str, Any]) -> None:
    gross = _extract_amount_value(api_payment.get("amount")) or float(row.amount_value or 0)
    income = _extract_amount_value(api_payment.get("income_amount"))
    if income is None:
        income = _extract_amount_value(api_payment.get("net_amount"))
    if income is not None and gross > 0:
        row.income_amount = income
        row.acquiring_fee_amount = max(0.0, round(gross - income, 2))
    elif income is not None:
        row.income_amount = income
        row.acquiring_fee_amount = 0.0


def apply_refund_economics(row: _EconomicsRow, refund: dict[str, Any]) -> None:
    amount = _extract_amount_value(refund.get("amount"))
    if amount is not None:
        row.refund_amount = amount
    status = str(refund.get("status") or "")
    if status == "succeeded":
        created = refund.get("created_at") or refund.get("succeeded_at")
        if created:
            try:
                row.refunded_at = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
            except ValueError:
                row.refunded_at = datetime.now(timezone.utc)
        elif row.refunded_at is None:
            row.refunded_at = datetime.now(timezone.utc)
