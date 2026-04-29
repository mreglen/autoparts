from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.models.avito_orders_cache import AvitoOrderCache
from app.models.organization_avito_integration import OrganizationAvitoIntegration
from app.models.stock_out import StockOut
from app.services.avito_orders_api import AvitoOrdersError, fetch_avito_orders
from app.utils.avito_crypto import decrypt_secret
from app.services import avito_api as avito_api_svc

logger = logging.getLogger(__name__)


def _normalize_status(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip().lower()


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
    closed_orders_to_process = []  # Список заказов для обработки после коммита

    for raw in orders:
        if not isinstance(raw, dict):
            skipped += 1
            continue
        raw_id = raw.get("id") or raw.get("order_id") or raw.get("orderId")
        if raw_id is None:
            skipped += 1
            continue
        avito_order_id = str(raw_id)
        
        # Логируем статус заказа
        status_code = raw.get("status") or raw.get("status_code") or raw.get("statusCode")
        logger.debug(f"Processing Avito order {avito_order_id}, status={status_code}")

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
            old_status = row.avito_status_code
            new_status = str(status_code) if status_code is not None else row.avito_status_code
            old_status_normalized = _normalize_status(old_status)
            new_status_normalized = _normalize_status(new_status)
            
            row.avito_status_code = new_status
            row.avito_data = raw
            row.total_amount = total_amount
            row.is_paid = is_paid
            row.synced_at = now
            updated += 1
            
            # Проверяем, стал ли заказ закрытым (изменение статуса на closed)
            # Обрабатываем если:
            # 1. Статус только что изменился на closed (old_status != "closed")
            # 2. ИЛИ заказ уже был closed но еще не обработан (not row.closed_processed)
            if new_status_normalized == "closed":
                if old_status_normalized != "closed" or not row.closed_processed:
                    closed_orders_to_process.append(row)

    db.commit()
    
    # Находим все закрытые заказы, которые еще не были обработаны
    # (страховка на случай если обработка не сработала ранее)
    unprocessed_closed_orders = (
        db.query(AvitoOrderCache)
        .outerjoin(
            StockOut,
            and_(
                StockOut.organization_id == AvitoOrderCache.organization_id,
                StockOut.avito_order_id == AvitoOrderCache.avito_order_id,
            ),
        )
        .filter(
            AvitoOrderCache.organization_id == organization_id,
            func.lower(func.trim(AvitoOrderCache.avito_status_code)) == "closed",
            or_(
                AvitoOrderCache.closed_processed == False,
                StockOut.id.is_(None),
            ),
        )
        .all()
    )
    
    if unprocessed_closed_orders:
        logger.info(f"Found {len(unprocessed_closed_orders)} unprocessed closed orders in database")
        for order in unprocessed_closed_orders:
            logger.info(f"  - Order id={order.id}, avito_order_id={order.avito_order_id}")
    
    # Добавляем их в список для обработки, избегая дубликатов
    existing_ids = {order.id for order in closed_orders_to_process}
    for order in unprocessed_closed_orders:
        if order.id not in existing_ids:
            closed_orders_to_process.append(order)
            logger.info(f"Found unprocessed/inconsistent closed order {order.id} (avito_order_id={order.avito_order_id})")
    
    # Обрабатываем закрытые заказы после коммита
    if closed_orders_to_process:
        logger.info(f"Processing {len(closed_orders_to_process)} closed Avito orders")
        for order in closed_orders_to_process:
            try:
                # Импортируем здесь, чтобы избежать циклических зависимостей
                from app.services.avito_closed_order_processor import process_closed_avito_order
                process_result = await process_closed_avito_order(
                    db,
                    order,
                    access_token=token,
                    avito_user_id=int(integration.avito_user_id),
                )
                
                processed_count = int(process_result.get("processed_count", 0))
                order.closed_processed = processed_count > 0
                db.commit()  # Коммитим изменения после обработки каждого заказа
                
                logger.info(
                    "Processed closed Avito order %s: processed_count=%s skipped_count=%s closed_processed=%s",
                    order.id,
                    processed_count,
                    process_result.get("skipped_count", 0),
                    order.closed_processed,
                )
            except Exception as e:
                logger.error(
                    f"Error processing closed Avito order {order.id}: {e}",
                    exc_info=True
                )
                # Не прерываем обработку остальных заказов
                db.rollback()
    
    return {"created": created, "updated": updated, "skipped": skipped, "total": len(orders)}

