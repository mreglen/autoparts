from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.product import Product as ProductModel
from app.schemas.product import (
    ProductListItem,
    ProductListOrganizationSummary,
    ProductListPhotoSummary,
    ProductListStorageSummary,
)
from app.utils.product_price import display_product_price


def _first_list_photo(product: ProductModel) -> ProductListPhotoSummary | None:
    photos = sorted(product.photos or [], key=lambda p: p.id)
    for photo in photos:
        url = (photo.photo_url or "").strip()
        if not url:
            continue
        lower = url.lower()
        if lower.endswith((
            ".mp4", ".avi", ".mov", ".wmv", ".flv", ".mkv", ".webm",
        )) or "/uploads/videos/" in lower:
            continue
        list_url = (photo.list_photo_url or photo.photo_url or "").strip()
        return ProductListPhotoSummary(
            id=photo.id,
            photo_url=photo.photo_url,
            thumb_url=getattr(photo, "thumb_url", None),
            list_photo_url=list_url or photo.photo_url,
            full_url=photo.full_url,
        )
    return None


def map_product_to_list_item(product: ProductModel, *, db: Session | None = None) -> ProductListItem:
    first_photo = _first_list_photo(product)
    org = getattr(product, "organization", None)
    storage = getattr(product, "storage_location", None)
    price = display_product_price(product.price, db=db) if db else float(product.price or 0)
    return ProductListItem(
        id=product.id,
        brand=product.brand or "",
        article=product.article or "",
        name=product.name or "",
        price=float(price or 0),
        quantity=int(product.quantity or 0),
        is_new=bool(product.is_new),
        organization_id=str(product.organization_id or ""),
        storage_location_id=int(product.storage_location_id or 0),
        created_at=product.created_at,
        list_photo_url=first_photo.list_photo_url if first_photo else None,
        photos=[first_photo] if first_photo else [],
        organization=ProductListOrganizationSummary(
            id=str(org.id),
            name=getattr(org, "name", None),
            phone=getattr(org, "phone", None),
        ) if org else None,
        storage_location=ProductListStorageSummary(
            id=int(storage.id),
            address=getattr(storage, "address", None),
        ) if storage else None,
    )
