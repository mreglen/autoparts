"""
Сопоставление позиции заказа Авито с товаром на складе (как в avito_closed_order_processor).
"""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.product_avito_listing_link import ProductAvitoListingLink


def avito_item_identifiers(item: dict) -> tuple[Any, Any]:
    avito_item_id = (
        item.get("avitoId")
        or item.get("avito_id")
        or item.get("avitoItemId")
        or item.get("itemId")
        or item.get("id")
        or item.get("offerId")
    )
    internal_code = (
        item.get("internal_code")
        or item.get("internalCode")
        or item.get("article")
        or item.get("partnumber")
        or item.get("partNumber")
        or item.get("sku")
    )
    return avito_item_id, internal_code


def resolve_product_id_from_avito_item(
    db: Session,
    organization_id: str,
    item: dict,
) -> Optional[int]:
    avito_item_id, internal_code = avito_item_identifiers(item)
    listing_link = None

    if avito_item_id:
        listing_link = (
            db.query(ProductAvitoListingLink)
            .filter_by(
                organization_id=organization_id,
                avito_id=str(avito_item_id),
            )
            .first()
        )

    if not listing_link and internal_code:
        listing_link = (
            db.query(ProductAvitoListingLink)
            .filter_by(
                organization_id=organization_id,
                avito_ad_id=str(internal_code),
            )
            .first()
        )

    if listing_link and listing_link.product_id:
        return int(listing_link.product_id)
    return None


def find_avito_item_for_product_id(
    items: list,
    db: Session,
    organization_id: str,
    product_id: int,
) -> Optional[dict]:
    return find_avito_item_for_product(items, db, organization_id, product_id)


def find_avito_item_for_product(
    items: list,
    db: Session,
    organization_id: str,
    product_id: int,
    *,
    product: Product | None = None,
) -> Optional[dict]:
    """
    Найти позицию заказа для товара. Listing-ссылки могут быть уже удалены после closed.
    """
    valid_items = [x for x in items if isinstance(x, dict)]

    for item in valid_items:
        pid = resolve_product_id_from_avito_item(db, organization_id, item)
        if pid == product_id:
            return item

    if product is None:
        product = db.query(Product).filter(Product.id == product_id).first()

    if len(valid_items) == 1:
        return valid_items[0]

    if product:
        for item in valid_items:
            _, internal_code = avito_item_identifiers(item)
            if not internal_code:
                continue
            code = str(internal_code)
            if product.internal_code and code == str(product.internal_code):
                return item
            if product.article and code == str(product.article):
                return item

    return None
