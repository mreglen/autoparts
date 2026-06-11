from __future__ import annotations

from sqlalchemy import exists, func
from sqlalchemy.orm import Session, selectinload

from app.models.organization import Organization
from app.models.product import Product, ProductPhoto
from app.utils.slug_utils import slugify_brand


def _in_stock_filter():
    return func.coalesce(Product.quantity, 0) > 0


def _used_filters():
    return (
        Product.is_new.is_(False),
        _in_stock_filter(),
    )


def _brand_used_query(db: Session, brand_name: str):
    brand_text = (brand_name or "").strip()
    return (
        db.query(Product)
        .filter(*_used_filters(), Product.brand == brand_text)
        .order_by(Product.id.desc())
    )


def _part_type_used_query(db: Session, part_type_id: int):
    return (
        db.query(Product)
        .filter(*_used_filters(), Product.part_type_id == part_type_id)
        .order_by(Product.id.desc())
    )


def _city_used_query(db: Session, city: str):
    city_text = (city or "").strip()
    return (
        db.query(Product)
        .join(Organization, Product.organization_id == Organization.id)
        .filter(*_used_filters(), Organization.address.ilike(f"%{city_text}%"))
        .order_by(Product.id.desc())
    )


def find_used_brand_name_by_slug(db: Session, slug: str) -> str | None:
    slug_text = (slug or "").strip().lower()
    if not slug_text:
        return None
    rows = (
        db.query(Product.brand)
        .filter(
            *_used_filters(),
            Product.brand.isnot(None),
            Product.brand != "",
        )
        .distinct()
        .all()
    )
    for (brand,) in rows:
        if brand and slugify_brand(brand) == slug_text:
            return brand
    return None


def count_used_products_by_brand(db: Session, brand_name: str) -> int:
    brand_text = (brand_name or "").strip()
    if not brand_text:
        return 0
    return int(
        db.query(func.count(Product.id))
        .filter(*_used_filters(), Product.brand == brand_text)
        .scalar()
        or 0
    )


def count_used_products_by_part_type_id(db: Session, part_type_id: int | None) -> int:
    if part_type_id is None:
        return 0
    return int(
        db.query(func.count(Product.id))
        .filter(*_used_filters(), Product.part_type_id == int(part_type_id))
        .scalar()
        or 0
    )


def count_used_products_by_city(db: Session, city: str) -> int:
    city_text = (city or "").strip()
    if len(city_text) < 2:
        return 0
    return int(
        db.query(func.count(Product.id))
        .join(Organization, Product.organization_id == Organization.id)
        .filter(*_used_filters(), Organization.address.ilike(f"%{city_text}%"))
        .scalar()
        or 0
    )


def _load_options():
    return [
        selectinload(Product.photos),
        selectinload(Product.organization),
        selectinload(Product.part_type),
    ]


def iter_used_products_by_brand_for_prerender(
    db: Session,
    brand_name: str,
    *,
    limit: int = 48,
) -> list[Product]:
    brand_text = (brand_name or "").strip()
    if not brand_text:
        return []
    return (
        _brand_used_query(db, brand_text)
        .options(*_load_options())
        .limit(max(1, min(limit, 100)))
        .all()
    )


def iter_used_products_by_part_type_for_prerender(
    db: Session,
    part_type_id: int | None,
    *,
    limit: int = 48,
) -> list[Product]:
    if part_type_id is None:
        return []
    return (
        _part_type_used_query(db, int(part_type_id))
        .options(*_load_options())
        .limit(max(1, min(limit, 100)))
        .all()
    )


def iter_used_products_by_city_for_prerender(
    db: Session,
    city: str,
    *,
    limit: int = 48,
) -> list[Product]:
    city_text = (city or "").strip()
    if len(city_text) < 2:
        return []
    return (
        _city_used_query(db, city_text)
        .options(*_load_options())
        .limit(max(1, min(limit, 100)))
        .all()
    )
