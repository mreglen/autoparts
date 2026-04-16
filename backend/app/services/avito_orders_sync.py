from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.avito_orders_cache import AvitoOrderCache
from app.models.organization_avito_integration import OrganizationAvitoIntegration
from app.services.avito_orders_api import AvitoOrdersError, fetch_avito_orders
from app.utils.avito_crypto import decrypt_secret
from app.services import avito_api as avito_api_svc

logger = logging.getLogger(__name__)


def _parse_dt(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    # epoch seconds / ms
    try:
        if isinstance(value, (int, float)):
            v = float(value)
            if v > 10_000_000_000:  # ms
                v = v / 1000.0
            return datetime.fromtimestamp(v, tz=timezone.utc)
    except Exception:
        pass
    # ISO-ish string
    try:
        s = str(value).strip()
        if not s:
            return None
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.fromisoformat(s)
    except Exception:
        return None


def _extract_total_amount(order: dict[str, Any]) -> float:
    for key in ("total_price", "totalPrice", "total", "amount", "price"):
        v = order.get(key)
        try:
            if v is not None and v != "":
                return float(v)
        except Exception:
            pass
    # try compute from items
    items = order.get("items") or order.get("products") or []
    if isinstance(items, list):
        total = 0.0
        for it in items:
            if not isinstance(it, dict):
                continue
            try:
                p = float(it.get("price") or it.get("total_price") or 0)
            except Exception:
                p = 0.0
            try:
                q = int(it.get("quantity") or it.get("count") or 1)
            except Exception:
                q = 1
            total += p * max(q, 1)
        return float(total)
    return 0.0


def _extract_is_paid(order: dict[str, Any]) -> bool:
    for key in ("is_paid", "isPaid", "paid"):
        v = order.get(key)
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            if v.lower() in ("true", "1", "yes", "paid"):
                return True
            if v.lower() in ("false", "0", "no", "unpaid"):
                return False
    payment = order.get("payment") or order.get("payment_info") or order.get("paymentInfo")
    if isinstance(payment, dict):
        v = payment.get("status") or payment.get("state")
        if isinstance(v, str) and v.lower() in ("paid", "success", "completed"):
            return True
    return False


async def sync_avito_orders_for_org(db: Session, *, organization_id: str) -> dict[str, Any]:
    integration = (
        db.query(OrganizationAvitoIntegration)
        .filter(OrganizationAvitoIntegration.organization_id == organization_id)
        .first()
    )
    if not integration or not integration.enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Интеграция Авито не настроена")
    if not integration.client_id or not integration.client_secret_encrypted or not integration.avito_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Интеграция Авито не настроена")

    try:
        secret = decrypt_secret(integration.client_secret_encrypted)
        token = await avito_api_svc.fetch_access_token(integration.client_id, secret)
        data = await fetch_avito_orders(token, int(integration.avito_user_id))
    except AvitoOrdersError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
    except Exception as e:
        logger.exception("Avito sync error")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    orders = data.get("orders") or []
    if not isinstance(orders, list):
        orders = []

    now = datetime.now(tz=timezone.utc)
    created = 0
    updated = 0
    skipped = 0

    for raw in orders:
        if not isinstance(raw, dict):
            skipped += 1
            continue
        raw_id = raw.get("id") or raw.get("order_id") or raw.get("orderId")
        if raw_id is None:
            skipped += 1
            continue
        avito_order_id = str(raw_id)

        row = (
            db.query(AvitoOrderCache)
            .filter(
                AvitoOrderCache.organization_id == organization_id,
                AvitoOrderCache.avito_order_id == avito_order_id,
            )
            .first()
        )

        status_code = raw.get("status") or raw.get("status_code") or raw.get("statusCode")
        total_amount = _extract_total_amount(raw)
        is_paid = _extract_is_paid(raw)

        if row is None:
            row = AvitoOrderCache(
                organization_id=organization_id,
                avito_order_id=avito_order_id,
                avito_status_code=str(status_code) if status_code is not None else None,
                avito_data=raw,
                total_amount=total_amount,
                is_paid=is_paid,
                synced_at=now,
            )
            # If Avito provides its own creation time, keep it for sorting.
            created_at = _parse_dt(raw.get("created_at") or raw.get("createdAt") or raw.get("created"))
            if created_at is not None:
                row.created_at = created_at
            db.add(row)
            created += 1
        else:
            row.avito_status_code = str(status_code) if status_code is not None else row.avito_status_code
            row.avito_data = raw
            row.total_amount = total_amount
            row.is_paid = is_paid
            row.synced_at = now
            updated += 1

    db.commit()
    return {"created": created, "updated": updated, "skipped": skipped, "total": len(orders)}

