from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.garage_used_orders import GarageUsedOrder, GarageUsedOrderItem
from app.models.product import Product
from app.services.stock_sale_fulfillment import (
    FulfillStockOutRequest,
    StockOutSourceKind,
    fulfill_stock_out,
)

FULFILLMENT_TRIGGER_STATUS = "assembled"


@dataclass(frozen=True)
class FulfilledItemSummary:
    order_item_id: int
    stock_out_id: int
    created: bool


def _raise_insufficient_as_conflict(exc: HTTPException) -> None:
    detail = exc.detail
    message = detail if isinstance(detail, str) else str(detail)
    if "Недостаточно" in message or "недостаточно" in message.lower():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
        ) from exc
    raise exc


def fulfill_used_order_on_status_change(
    db: Session,
    *,
    order: GarageUsedOrder,
    new_status_code: str,
    previous_status_code: str,
    acting_user_id: Optional[int],
) -> list[FulfilledItemSummary]:
    """
    Create stock_out rows when order transitions into assembled status.
    Idempotent per order line via stock_out.garage_used_order_item_id and item.stock_out_id.
    """
    if new_status_code != FULFILLMENT_TRIGGER_STATUS:
        return []
    if previous_status_code == FULFILLMENT_TRIGGER_STATUS:
        return []

    items = list(order.items or [])
    if not items:
        return []

    fulfilled: list[FulfilledItemSummary] = []
    for item in items:
        summary = _fulfill_single_used_item(
            db,
            order=order,
            item=item,
            acting_user_id=acting_user_id,
        )
        if summary:
            fulfilled.append(summary)
    return fulfilled


def _fulfill_single_used_item(
    db: Session,
    *,
    order: GarageUsedOrder,
    item: GarageUsedOrderItem,
    acting_user_id: Optional[int],
) -> Optional[FulfilledItemSummary]:
    if item.product_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Позиция заказа #{item.id} без product_id — списание невозможно",
        )

    if item.stock_out_id is not None:
        return FulfilledItemSummary(
            order_item_id=item.id,
            stock_out_id=item.stock_out_id,
            created=False,
        )

    product = (
        db.query(Product)
        .filter(
            Product.id == item.product_id,
            Product.organization_id == order.organization_id,
        )
        .first()
    )
    if not product:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Товар id={item.product_id} не найден у продавца {order.organization_id}",
        )

    if product.storage_location_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"У товара id={item.product_id} не указано место хранения — "
                "невозможно списать со склада"
            ),
        )

    try:
        result = fulfill_stock_out(
            db,
            FulfillStockOutRequest(
                organization_id=order.organization_id,
                product_id=item.product_id,
                quantity=item.quantity,
                sale_price=float(item.price),
                storage_location_id=product.storage_location_id,
                movement_date=date.today(),
                source_kind=StockOutSourceKind.MARKETPLACE_USED,
                user_id=acting_user_id,
                acquired_product_id=None,
                reason="Продажа через маркетплейс Б/У",
                sale_channel="marketplace_used",
                avito_order_id=None,
                garage_used_order_item_id=item.id,
            ),
            commit=False,
        )
    except HTTPException as exc:
        _raise_insufficient_as_conflict(exc)

    now = datetime.now(timezone.utc)
    item.stock_out_id = result.stock_out.id
    item.fulfilled_at = now
    item.status_code = FULFILLMENT_TRIGGER_STATUS

    return FulfilledItemSummary(
        order_item_id=item.id,
        stock_out_id=result.stock_out.id,
        created=result.created,
    )


def fulfill_used_order_item_on_status_change(
    db: Session,
    *,
    order: GarageUsedOrder,
    item: GarageUsedOrderItem,
    new_status_code: str,
    previous_status_code: str,
    acting_user_id: Optional[int],
) -> Optional[FulfilledItemSummary]:
    """Списание со склада для одной позиции при переходе в assembled."""
    if new_status_code != FULFILLMENT_TRIGGER_STATUS:
        return None
    if previous_status_code == FULFILLMENT_TRIGGER_STATUS:
        return None
    return _fulfill_single_used_item(db, order=order, item=item, acting_user_id=acting_user_id)
