from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.carts import UsedPartsCart
from app.models.garage_used_orders import GarageUsedOrder, GarageUsedOrderItem
from app.models.product import Product
from app.models.user import User as UserModel


@dataclass(frozen=True)
class UsedOrderItemInput:
    name: str
    brand: Optional[str]
    partnumber: Optional[str]
    quantity: int
    price: float
    product_id: Optional[int]


@dataclass(frozen=True)
class UsedOrderDeliveryInput:
    buyer_name: str
    buyer_phone: str
    buyer_email: str
    delivery_type: str
    delivery_address: Optional[str]
    transport_company: Optional[str]
    pickup_address: Optional[str]
    delivery_region_id: Optional[int] = None
    delivery_region_name: Optional[str] = None
    buyer_comment: Optional[str] = None


@dataclass(frozen=True)
class CreatedUsedOrderSummary:
    id: int
    organization_id: str
    total_amount: float


def _load_products_by_id(db: Session, product_ids: set[int]) -> dict[int, Product]:
    if not product_ids:
        return {}
    rows = db.query(Product).filter(Product.id.in_(product_ids)).all()
    return {p.id: p for p in rows}


def _validate_stock(products_by_id: dict[int, Product], items: list[UsedOrderItemInput]) -> None:
    requested_by_product: dict[int, int] = defaultdict(int)
    for item in items:
        if item.product_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Для каждой позиции заказа требуется product_id",
            )
        requested_by_product[item.product_id] += item.quantity

    for product_id, requested_qty in requested_by_product.items():
        product = products_by_id.get(product_id)
        if product is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Товар с id={product_id} не найден",
            )
        if product.organization_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"У товара id={product_id} не указана организация продавца",
            )
        available = product.quantity
        if available is None or available < requested_qty:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "Недостаточно товара на складе",
                    "product_id": product_id,
                    "requested": requested_qty,
                    "available": available if available is not None else 0,
                },
            )


def _group_items_by_seller(
    items: list[UsedOrderItemInput],
    products_by_id: dict[int, Product],
) -> dict[str, list[UsedOrderItemInput]]:
    groups: dict[str, list[UsedOrderItemInput]] = defaultdict(list)
    for item in items:
        product = products_by_id[item.product_id]  # type: ignore[arg-type]
        seller_org = product.organization_id
        groups[seller_org].append(item)
    return dict(groups)


def _remove_used_cart_items(
    db: Session,
    *,
    user_id: int,
    used_cart_item_ids: list[int],
) -> None:
    if not used_cart_item_ids:
        return
    owned_ids = {
        row[0]
        for row in db.query(UsedPartsCart.id)
        .filter(
            UsedPartsCart.user_id == user_id,
            UsedPartsCart.id.in_(used_cart_item_ids),
        )
        .all()
    }
    missing = set(used_cart_item_ids) - owned_ids
    if missing:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Некоторые позиции корзины недоступны для оформления",
        )
    db.query(UsedPartsCart).filter(
        UsedPartsCart.user_id == user_id,
        UsedPartsCart.id.in_(used_cart_item_ids),
    ).delete(synchronize_session=False)


def create_used_orders_from_payload(
    db: Session,
    *,
    current_user: UserModel,
    items: list[UsedOrderItemInput],
    delivery: UsedOrderDeliveryInput,
    used_cart_item_ids: list[int],
) -> list[CreatedUsedOrderSummary]:
    if not items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Список товаров пуст",
        )

    product_ids = {item.product_id for item in items if item.product_id is not None}
    products_by_id = _load_products_by_id(db, product_ids)
    _validate_stock(products_by_id, items)
    groups = _group_items_by_seller(items, products_by_id)

    created: list[CreatedUsedOrderSummary] = []
    for seller_org_id, group_items in groups.items():
        total_amount = sum(float(item.price) * item.quantity for item in group_items)
        order = GarageUsedOrder(
            organization_id=seller_org_id,
            buyer_name=delivery.buyer_name,
            buyer_phone=delivery.buyer_phone,
            buyer_email=delivery.buyer_email or "",
            user_id=current_user.id,
            buyer_comment=(delivery.buyer_comment or "").strip() or None,
            delivery_type=delivery.delivery_type,
            delivery_address=delivery.delivery_address,
            transport_company=delivery.transport_company,
            pickup_address=delivery.pickup_address,
            delivery_region_id=delivery.delivery_region_id,
            delivery_region_name=delivery.delivery_region_name,
            total_amount=total_amount,
            is_paid=False,
            status_code="pending",
        )
        db.add(order)
        db.flush()
        for item in group_items:
            db.add(
                GarageUsedOrderItem(
                    order_id=order.id,
                    product_id=item.product_id,
                    name=item.name,
                    brand=item.brand,
                    partnumber=item.partnumber,
                    quantity=item.quantity,
                    price=float(item.price),
                    status_code="pending",
                )
            )
        created.append(
            CreatedUsedOrderSummary(
                id=order.id,
                organization_id=seller_org_id,
                total_amount=total_amount,
            )
        )

    _remove_used_cart_items(db, user_id=current_user.id, used_cart_item_ids=used_cart_item_ids)
    return created
