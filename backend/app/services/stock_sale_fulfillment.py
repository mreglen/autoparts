from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from enum import Enum
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.stock_out import StockOut
from app.services.audit_service import log_audit
from app.utils.public_catalog_cache import (
    invalidate_public_catalog_cache,
    invalidate_public_product_detail,
)


class StockOutSourceKind(str, Enum):
    WAREHOUSE_MANUAL = "warehouse_manual"
    WRITEOFF = "writeoff"
    AVITO = "avito"
    MARKETPLACE_USED = "marketplace_used"


@dataclass(frozen=True)
class FulfillStockOutRequest:
    organization_id: str
    product_id: int
    quantity: int
    sale_price: float
    storage_location_id: int
    movement_date: date
    source_kind: StockOutSourceKind
    user_id: Optional[int] = None
    acquired_product_id: Optional[int] = None
    reason: Optional[str] = None
    sale_channel: Optional[str] = None
    avito_order_id: Optional[str] = None
    garage_used_order_item_id: Optional[int] = None


@dataclass(frozen=True)
class FulfillStockOutResult:
    stock_out: StockOut
    created: bool


def _existing_avito_stock_out(
    db: Session,
    request: FulfillStockOutRequest,
) -> Optional[StockOut]:
    if not request.avito_order_id:
        return None

    return (
        db.query(StockOut)
        .filter(
            StockOut.organization_id == request.organization_id,
            StockOut.product_id == request.product_id,
            StockOut.avito_order_id == str(request.avito_order_id),
        )
        .first()
    )


def _existing_marketplace_used_stock_out(
    db: Session,
    request: FulfillStockOutRequest,
) -> Optional[StockOut]:
    if not request.garage_used_order_item_id:
        return None

    return (
        db.query(StockOut)
        .filter(StockOut.garage_used_order_item_id == request.garage_used_order_item_id)
        .first()
    )


def _find_existing_stock_out(
    db: Session,
    request: FulfillStockOutRequest,
) -> Optional[StockOut]:
    if request.source_kind == StockOutSourceKind.AVITO:
        return _existing_avito_stock_out(db, request)
    if request.source_kind == StockOutSourceKind.MARKETPLACE_USED:
        return _existing_marketplace_used_stock_out(db, request)
    return None


def fulfill_stock_out(
    db: Session,
    request: FulfillStockOutRequest,
    *,
    commit: bool = True,
) -> FulfillStockOutResult:
    """
    Create a stock_out record and decrement product quantity.

    Avito and future marketplace flows are idempotent by source key. Manual
    warehouse operations intentionally create a new record for every action.
    """
    if request.quantity <= 0:
        raise HTTPException(status_code=400, detail="Количество должно быть больше 0")

    existing = _find_existing_stock_out(db, request)
    if existing:
        return FulfillStockOutResult(stock_out=existing, created=False)

    product = (
        db.query(Product)
        .filter(
            Product.id == request.product_id,
            Product.organization_id == request.organization_id,
        )
        .first()
    )
    if not product:
        raise HTTPException(status_code=400, detail="Продукт не найден или недоступен")

    if (product.quantity or 0) < request.quantity:
        raise HTTPException(status_code=400, detail="Недостаточно товара на складе")

    stock_out = StockOut(
        organization_id=request.organization_id,
        product_id=request.product_id,
        acquired_product_id=request.acquired_product_id,
        storage_location_id=request.storage_location_id,
        user_id=request.user_id,
        quantity=request.quantity,
        sale_price=request.sale_price,
        movement_date=request.movement_date,
        reason=request.reason,
        sale_channel=request.sale_channel,
        avito_order_id=request.avito_order_id,
        source_kind=request.source_kind.value,
        garage_used_order_item_id=request.garage_used_order_item_id,
    )
    product.quantity -= request.quantity
    db.add(stock_out)

    try:
        if commit:
            db.commit()
            db.refresh(stock_out)
        else:
            db.flush()
    except IntegrityError:
        db.rollback()
        existing = _find_existing_stock_out(db, request)
        if existing:
            return FulfillStockOutResult(stock_out=existing, created=False)
        raise

    kind_label = request.source_kind.value
    is_writeoff = request.source_kind == StockOutSourceKind.WRITEOFF
    log_audit(
        db,
        event_type="stock_out_created",
        category="warehouse",
        summary=(
            f"{'Списание' if is_writeoff else 'Расход'}: product #{request.product_id}, "
            f"{request.quantity} шт., источник {kind_label}"
        ),
        user_id=request.user_id,
        organization_id=request.organization_id,
        details={
            "stock_out_id": stock_out.id,
            "product_id": request.product_id,
            "quantity": request.quantity,
            "sale_price": request.sale_price,
            "source_kind": kind_label,
        },
        entity_type="stock_out",
        entity_id=stock_out.id,
    )

    invalidate_public_catalog_cache()
    invalidate_public_product_detail(request.product_id)

    return FulfillStockOutResult(stock_out=stock_out, created=True)
