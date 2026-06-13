from __future__ import annotations

from sqlalchemy import exists, func
from sqlalchemy.orm import Session, selectinload

from app.models.organization import Organization
from app.models.product import Product, ProductPhoto
from app.utils.partnumber import normalize_partnumber
from app.utils.product_urls import build_product_used_catalog_search_query
from app.utils.slug_utils import slugify_brand


def _normalize_used_catalog_query(q: str) -> str:
    return (q or "").strip().casefold()


def _sql_normalize_article(column):
    return func.replace(
        func.replace(
            func.replace(
                func.replace(
                    func.replace(
                        func.replace(
                            func.replace(func.upper(column), "-", ""),
                            " ",
                            "",
                        ),
                        ".",
                        "",
                    ),
                    "/",
                    "",
                ),
                "(",
                "",
            ),
            ")",
            "",
        ),
        "_",
        "",
    )


def _working_product_photo_exists():
    return exists().where(
        ProductPhoto.product_id == Product.id,
        ProductPhoto.photo_url.isnot(None),
        ProductPhoto.photo_url != "",
    )


def _working_products_query(db: Session):
    return (
        db.query(Product)
        .options(selectinload(Product.photos))
        .filter(
            func.coalesce(Product.quantity, 0) > 0,
            func.trim(Product.brand) != "",
            Product.brand.isnot(None),
            func.trim(Product.article) != "",
            Product.article.isnot(None),
            func.trim(Product.name) != "",
            Product.name.isnot(None),
            _working_product_photo_exists(),
        )
    )


def _single_working_match(matches: list[Product]) -> Product | None:
    from app.services.sitemap_service import is_working_catalog_product

    working = [product for product in matches if is_working_catalog_product(product)]
    if len(working) == 1:
        return working[0]
    return None


def find_indexable_used_catalog_product(db: Session, q: str) -> tuple[Product, str] | None:
    """
    Находит единственную рабочую карточку для индексируемого /autoparts/used?q=…
    match_type: canonical | article | name
    """
    normalized_q = _normalize_used_catalog_query(q)
    if not normalized_q:
        return None

    base = _working_products_query(db)

    canonical_expr = func.lower(
        func.trim(
            func.concat(
                func.trim(Product.brand),
                " ",
                func.trim(Product.article),
            )
        )
    )
    canonical_match = _single_working_match(
        base.filter(canonical_expr == normalized_q).all()
    )
    if canonical_match is not None:
        return canonical_match, "canonical"

    article_norm = normalize_partnumber(q)
    if article_norm:
        article_match = _single_working_match(
            base.filter(_sql_normalize_article(Product.article) == article_norm).all()
        )
        if article_match is not None:
            return article_match, "article"

    name_match = _single_working_match(
        base.filter(func.lower(func.trim(Product.name)) == normalized_q).all()
    )
    if name_match is not None:
        return name_match, "name"

    return None


def find_working_product_by_used_catalog_query(db: Session, q: str) -> Product | None:
    result = find_indexable_used_catalog_product(db, q)
    if result is None:
        return None
    return result[0]


def _in_stock_filter():
    return func.coalesce(Product.quantity, 0) > 0


def _used_filters():
    return (_in_stock_filter(),)


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
