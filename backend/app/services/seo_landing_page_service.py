from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.new_parts_seo_card import NewPartsSeoCard
from app.models.part_type import PartType
from app.models.product import Product
from app.models.seo_landing_page import SEO_LANDING_KINDS, SeoLandingPage
from app.schemas.seo_landing_page import (
    SeoLandingPageCreate,
    SeoLandingPageUpdate,
    SeoLandingResolveOut,
    SeoLandingSeedResult,
)
from app.services.new_parts_seo_card_service import ROSSKO_NEW_PART_SOURCE
from app.services.used_catalog_service import find_used_brand_name_by_slug
from app.utils.organization_city import format_city_in_prepositional
from app.utils.slug_utils import is_valid_slug, slugify, slugify_brand

BRAND_KINDS = {"brand_new", "brand_used"}
CATEGORY_KINDS = {"category_new", "category_used"}


class SeoLandingPageValidationError(ValueError):
    pass


def _canonical_path_for_kind(kind: str, slug: str) -> str:
    if kind == "brand_new":
        return f"/autoparts/new/brand/{slug}"
    if kind == "category_new":
        return f"/autoparts/new/category/{slug}"
    if kind == "brand_used":
        return f"/autoparts/used/brand/{slug}"
    if kind == "category_used":
        return f"/autoparts/used/category/{slug}"
    if kind == "geo":
        return f"/autoparts/used/geo/{slug}"
    return f"/seo/{kind}/{slug}"


def _build_filters(row: SeoLandingPage) -> dict[str, Any]:
    if row.kind in BRAND_KINDS:
        return {"brand": row.brand_name}
    if row.kind in CATEGORY_KINDS:
        return {
            "search_query": row.search_query,
            "category_slug": row.slug,
            "part_type_id": row.part_type_id,
        }
    if row.kind == "geo":
        return {"city": row.city}
    return {}


def build_meta_title(row: SeoLandingPage) -> str:
    if row.meta_title:
        return row.meta_title.strip()
    if row.kind == "brand_new":
        brand = row.brand_name or row.title_ru
        return f"Новые запчасти {brand} — каталог с доставкой | Свой Гараж"
    if row.kind == "brand_used":
        brand = row.brand_name or row.title_ru
        return f"Б/у запчасти {brand} — каталог продавцов | Свой Гараж"
    if row.kind == "category_new":
        return f"Новые {row.title_ru} — купить с доставкой | Свой Гараж"
    if row.kind == "category_used":
        return f"Б/у {row.title_ru} — купить от продавцов | Свой Гараж"
    if row.kind == "geo":
        city = row.city or row.title_ru
        return f"Б/у автозапчасти в {city} | Свой Гараж"
    return f"{row.title_ru} | Свой Гараж"


def build_meta_description(row: SeoLandingPage) -> str:
    if row.meta_description:
        return row.meta_description.strip()
    if row.kind == "brand_new":
        brand = row.brand_name or row.title_ru
        return (
            f"Купить новые автозапчасти {brand}: каталог артикулов, цены, "
            f"доставка по России. Маркетплейс Свой Гараж."
        )
    if row.kind == "brand_used":
        brand = row.brand_name or row.title_ru
        return f"Купить б/у автозапчасти {brand}: объявления продавцов, цены, доставка."
    if row.kind == "category_new":
        return (
            f"Каталог новых {row.title_ru.lower()}: цены, артикулы, аналоги. "
            f"Доставка по России. Свой Гараж."
        )
    if row.kind == "category_used":
        return f"Каталог б/у {row.title_ru.lower()}: объявления, цены, доставка."
    if row.kind == "geo":
        city = row.city or row.title_ru
        return f"Б/у автозапчасти в {city}: объявления продавцов, цены, доставка."
    return row.title_ru


def _slug_source_for_row(data: dict[str, Any]) -> str:
    kind = data.get("kind")
    if kind in BRAND_KINDS:
        return (data.get("brand_name") or data.get("title_ru") or "").strip()
    if kind in CATEGORY_KINDS:
        return (data.get("title_ru") or data.get("search_query") or "").strip()
    if kind == "geo":
        return (data.get("city") or data.get("title_ru") or "").strip()
    return (data.get("title_ru") or "").strip()


def _normalize_slug_for_kind(kind: str, slug: str) -> str:
    text = slug.strip()
    if kind in BRAND_KINDS:
        return slugify_brand(text)
    return slugify(text)


def _validate_kind_fields(kind: str, data: dict[str, Any]) -> None:
    if kind not in SEO_LANDING_KINDS:
        raise SeoLandingPageValidationError(f"Недопустимый kind: {kind}")
    if kind in BRAND_KINDS and not (data.get("brand_name") or "").strip():
        raise SeoLandingPageValidationError("Для brand-посадочных нужен brand_name")
    if kind in CATEGORY_KINDS and not (data.get("search_query") or "").strip():
        raise SeoLandingPageValidationError("Для category-посадочных нужен search_query")
    if kind == "geo" and not (data.get("city") or "").strip():
        raise SeoLandingPageValidationError("Для geo-посадочных нужен city")


def _prepare_row_data(data: dict[str, Any], *, existing: Optional[SeoLandingPage] = None) -> dict[str, Any]:
    merged = {}
    if existing:
        merged = {
            "kind": existing.kind,
            "slug": existing.slug,
            "title_ru": existing.title_ru,
            "search_query": existing.search_query,
            "brand_name": existing.brand_name,
            "part_type_id": existing.part_type_id,
            "city": existing.city,
            "meta_title": existing.meta_title,
            "meta_description": existing.meta_description,
            "intro_html": existing.intro_html,
            "is_active": existing.is_active,
            "priority": existing.priority,
        }
    merged.update({k: v for k, v in data.items() if v is not None})

    for key in ("title_ru", "search_query", "brand_name", "city", "meta_title", "meta_description"):
        if key in merged and isinstance(merged[key], str):
            merged[key] = merged[key].strip() or None
    if "title_ru" in merged and merged["title_ru"]:
        merged["title_ru"] = merged["title_ru"].strip()

    _validate_kind_fields(merged["kind"], merged)

    slug = (merged.get("slug") or "").strip()
    if not slug:
        slug = _normalize_slug_for_kind(merged["kind"], _slug_source_for_row(merged))
    else:
        slug = _normalize_slug_for_kind(merged["kind"], slug)
    if not slug or not is_valid_slug(slug):
        raise SeoLandingPageValidationError("Некорректный slug")
    merged["slug"] = slug

    if not (merged.get("title_ru") or "").strip():
        if merged["kind"] in BRAND_KINDS:
            merged["title_ru"] = merged.get("brand_name") or slug
        elif merged["kind"] == "geo":
            merged["title_ru"] = merged.get("city") or slug
        else:
            merged["title_ru"] = merged.get("search_query") or slug

    return merged


def _check_unique_slug(
    db: Session,
    kind: str,
    slug: str,
    *,
    exclude_id: Optional[int] = None,
) -> None:
    query = db.query(SeoLandingPage).filter(
        SeoLandingPage.kind == kind,
        SeoLandingPage.slug == slug,
    )
    if exclude_id is not None:
        query = query.filter(SeoLandingPage.id != exclude_id)
    if query.first():
        raise SeoLandingPageValidationError(f"Посадочная {kind}/{slug} уже существует")


def list_landing_pages(
    db: Session,
    *,
    kind: Optional[str] = None,
    is_active: Optional[bool] = None,
    q: Optional[str] = None,
) -> list[SeoLandingPage]:
    query = db.query(SeoLandingPage)
    if kind:
        query = query.filter(SeoLandingPage.kind == kind)
    if is_active is not None:
        query = query.filter(SeoLandingPage.is_active.is_(is_active))
    if q:
        pattern = f"%{q.strip()}%"
        query = query.filter(
            (SeoLandingPage.slug.ilike(pattern))
            | (SeoLandingPage.title_ru.ilike(pattern))
            | (SeoLandingPage.brand_name.ilike(pattern))
            | (SeoLandingPage.search_query.ilike(pattern))
            | (SeoLandingPage.city.ilike(pattern))
        )
    return (
        query.order_by(
            SeoLandingPage.priority.desc(),
            SeoLandingPage.kind.asc(),
            SeoLandingPage.slug.asc(),
        ).all()
    )


def get_landing_page_by_id(db: Session, landing_id: int) -> Optional[SeoLandingPage]:
    return db.query(SeoLandingPage).filter(SeoLandingPage.id == landing_id).first()


def create_landing_page(db: Session, payload: SeoLandingPageCreate) -> SeoLandingPage:
    data = _prepare_row_data(payload.model_dump())
    _check_unique_slug(db, data["kind"], data["slug"])
    row = SeoLandingPage(**data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_landing_page(
    db: Session,
    row: SeoLandingPage,
    payload: SeoLandingPageUpdate,
) -> SeoLandingPage:
    data = _prepare_row_data(payload.model_dump(exclude_unset=True), existing=row)
    _check_unique_slug(db, data["kind"], data["slug"], exclude_id=row.id)
    for key, value in data.items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


def delete_landing_page(db: Session, row: SeoLandingPage) -> None:
    db.delete(row)
    db.commit()


def resolve_landing_page(db: Session, kind: str, slug: str) -> Optional[SeoLandingResolveOut]:
    row = (
        db.query(SeoLandingPage)
        .filter(
            SeoLandingPage.kind == kind,
            SeoLandingPage.slug == slug,
            SeoLandingPage.is_active.is_(True),
        )
        .first()
    )
    if not row:
        return None
    return SeoLandingResolveOut(
        kind=row.kind,
        slug=row.slug,
        title_ru=row.title_ru,
        search_query=row.search_query,
        brand_name=row.brand_name,
        part_type_id=row.part_type_id,
        city=row.city,
        meta_title=build_meta_title(row),
        meta_description=build_meta_description(row),
        intro_html=row.intro_html,
        filters=_build_filters(row),
        canonical_path=_canonical_path_for_kind(row.kind, row.slug),
    )


def find_brand_name_by_slug(db: Session, slug: str) -> Optional[str]:
    slug_text = (slug or "").strip().lower()
    if not slug_text:
        return None
    rows = (
        db.query(NewPartsSeoCard.brand)
        .filter(
            NewPartsSeoCard.is_active.is_(True),
            func.lower(NewPartsSeoCard.source) == ROSSKO_NEW_PART_SOURCE,
        )
        .distinct()
        .all()
    )
    for (brand,) in rows:
        if brand and slugify_brand(brand) == slug_text:
            return brand
    return None


def _build_brand_new_meta_description(brand_name: str, *, total: int | None = None) -> str:
    if total is not None and total > 0:
        return (
            f"Купить новые автозапчасти {brand_name}: {total} позиций в каталоге, "
            f"артикулы, цены, доставка по России."
        )
    return (
        f"Купить новые автозапчасти {brand_name}: каталог артикулов, цены, "
        f"доставка по России. Маркетплейс Свой Гараж."
    )


def resolve_brand_new_landing(
    db: Session,
    slug: str,
    *,
    card_count: int | None = None,
) -> Optional[SeoLandingResolveOut]:
    resolved = resolve_landing_page(db, "brand_new", slug)
    from_registry = resolved is not None

    if resolved:
        brand_name = resolved.brand_name or resolved.title_ru
    else:
        brand_name = find_brand_name_by_slug(db, slug)
        if not brand_name:
            return None
        resolved = SeoLandingResolveOut(
            kind="brand_new",
            slug=slug,
            title_ru=brand_name,
            search_query=None,
            brand_name=brand_name,
            part_type_id=None,
            city=None,
            meta_title=f"Новые запчасти {brand_name} — каталог с доставкой | Свой Гараж",
            meta_description=_build_brand_new_meta_description(brand_name, total=card_count),
            intro_html=None,
            filters={"brand": brand_name},
            canonical_path=f"/autoparts/new/brand/{slug}",
        )

    if card_count is not None and card_count > 0 and brand_name:
        registry_row = None
        if from_registry:
            registry_row = (
                db.query(SeoLandingPage)
                .filter(
                    SeoLandingPage.kind == "brand_new",
                    SeoLandingPage.slug == slug,
                    SeoLandingPage.is_active.is_(True),
                )
                .first()
            )
        has_custom_description = bool(
            registry_row and (registry_row.meta_description or "").strip()
        )
        if not has_custom_description:
            resolved = resolved.model_copy(
                update={
                    "meta_description": _build_brand_new_meta_description(
                        brand_name,
                        total=card_count,
                    )
                }
            )
    return resolved


def _build_category_new_meta_description(title_ru: str, *, total: int | None = None) -> str:
    if total is not None and total > 0:
        return (
            f"Каталог новых {title_ru.lower()}: {total} позиций, цены, артикулы, аналоги. "
            f"Доставка по России."
        )
    return (
        f"Каталог новых {title_ru.lower()}: цены, артикулы, аналоги. "
        f"Доставка по России. Маркетплейс Свой Гараж."
    )


def resolve_category_new_landing(
    db: Session,
    slug: str,
    *,
    card_count: int | None = None,
) -> Optional[SeoLandingResolveOut]:
    resolved = resolve_landing_page(db, "category_new", slug)
    if not resolved:
        return None

    title_ru = resolved.title_ru
    if card_count is not None and card_count > 0 and title_ru:
        registry_row = (
            db.query(SeoLandingPage)
            .filter(
                SeoLandingPage.kind == "category_new",
                SeoLandingPage.slug == slug,
                SeoLandingPage.is_active.is_(True),
            )
            .first()
        )
        has_custom_description = bool(
            registry_row and (registry_row.meta_description or "").strip()
        )
        if not has_custom_description:
            resolved = resolved.model_copy(
                update={
                    "meta_description": _build_category_new_meta_description(
                        title_ru,
                        total=card_count,
                    )
                }
            )
    return resolved


def _build_brand_used_meta_description(brand_name: str, *, total: int | None = None) -> str:
    if total is not None and total > 0:
        return (
            f"{total} б/у автозапчастей {brand_name} от продавцов на «Свой Гараж»: "
            f"фото, цены, чат с продавцом. Екатеринбург и доставка по России."
        )
    return (
        f"Купить б/у автозапчасти {brand_name}: объявления продавцов, цены, доставка."
    )


def resolve_brand_used_landing(
    db: Session,
    slug: str,
    *,
    product_count: int | None = None,
) -> Optional[SeoLandingResolveOut]:
    resolved = resolve_landing_page(db, "brand_used", slug)
    from_registry = resolved is not None

    if resolved:
        brand_name = resolved.brand_name or resolved.title_ru
    else:
        brand_name = find_used_brand_name_by_slug(db, slug)
        if not brand_name:
            return None
        resolved = SeoLandingResolveOut(
            kind="brand_used",
            slug=slug,
            title_ru=brand_name,
            search_query=None,
            brand_name=brand_name,
            part_type_id=None,
            city=None,
            meta_title=f"Б/у запчасти {brand_name} — каталог продавцов | Свой Гараж",
            meta_description=_build_brand_used_meta_description(brand_name, total=product_count),
            intro_html=None,
            filters={"brand": brand_name},
            canonical_path=f"/autoparts/used/brand/{slug}",
        )

    if product_count is not None and product_count > 0 and brand_name:
        registry_row = None
        if from_registry:
            registry_row = (
                db.query(SeoLandingPage)
                .filter(
                    SeoLandingPage.kind == "brand_used",
                    SeoLandingPage.slug == slug,
                    SeoLandingPage.is_active.is_(True),
                )
                .first()
            )
        has_custom_description = bool(
            registry_row and (registry_row.meta_description or "").strip()
        )
        if not has_custom_description:
            resolved = resolved.model_copy(
                update={
                    "meta_description": _build_brand_used_meta_description(
                        brand_name,
                        total=product_count,
                    )
                }
            )
    return resolved


def _build_category_used_meta_description(title_ru: str, *, total: int | None = None) -> str:
    if total is not None and total > 0:
        return (
            f"Каталог б/у {title_ru.lower()}: {total} объявлений, цены, доставка."
        )
    return f"Каталог б/у {title_ru.lower()}: объявления, цены, доставка."


def resolve_category_used_landing(
    db: Session,
    slug: str,
    *,
    product_count: int | None = None,
) -> Optional[SeoLandingResolveOut]:
    resolved = resolve_landing_page(db, "category_used", slug)
    if not resolved:
        return None

    title_ru = resolved.title_ru
    if product_count is not None and product_count > 0 and title_ru:
        registry_row = (
            db.query(SeoLandingPage)
            .filter(
                SeoLandingPage.kind == "category_used",
                SeoLandingPage.slug == slug,
                SeoLandingPage.is_active.is_(True),
            )
            .first()
        )
        has_custom_description = bool(
            registry_row and (registry_row.meta_description or "").strip()
        )
        if not has_custom_description:
            resolved = resolved.model_copy(
                update={
                    "meta_description": _build_category_used_meta_description(
                        title_ru,
                        total=product_count,
                    )
                }
            )
    return resolved


def _build_geo_meta_title(city: str) -> str:
    city_prep = format_city_in_prepositional(city)
    return f"Б/у автозапчасти в {city_prep} — каталог | Свой Гараж"


def _build_geo_meta_description(city: str, *, total: int | None = None) -> str:
    city_prep = format_city_in_prepositional(city)
    if total is not None and total > 0:
        return (
            f"Б/у автозапчасти в {city_prep}: {total} объявлений продавцов, цены, доставка."
        )
    return f"Б/у автозапчасти в {city_prep}: объявления продавцов, цены, доставка."


def resolve_geo_landing(
    db: Session,
    slug: str,
    *,
    product_count: int | None = None,
) -> Optional[SeoLandingResolveOut]:
    resolved = resolve_landing_page(db, "geo", slug)
    if not resolved:
        return None

    city = resolved.city or resolved.title_ru
    if city:
        registry_row = (
            db.query(SeoLandingPage)
            .filter(
                SeoLandingPage.kind == "geo",
                SeoLandingPage.slug == slug,
                SeoLandingPage.is_active.is_(True),
            )
            .first()
        )
        has_custom_title = bool(registry_row and (registry_row.meta_title or "").strip())
        has_custom_description = bool(
            registry_row and (registry_row.meta_description or "").strip()
        )
        updates: dict[str, Any] = {}
        if not has_custom_title:
            updates["meta_title"] = _build_geo_meta_title(city)
        if not has_custom_description:
            updates["meta_description"] = _build_geo_meta_description(
                city,
                total=product_count,
            )
        if updates:
            resolved = resolved.model_copy(update=updates)
    return resolved


def _top_brands_from_catalog(db: Session, limit: int = 10) -> list[tuple[str, str]]:
    rows = (
        db.query(
            func.lower(NewPartsSeoCard.brand).label("brand_key"),
            func.max(NewPartsSeoCard.brand).label("display_brand"),
            func.count(NewPartsSeoCard.id).label("card_count"),
        )
        .filter(
            NewPartsSeoCard.is_active.is_(True),
            func.lower(NewPartsSeoCard.source) == ROSSKO_NEW_PART_SOURCE,
        )
        .group_by(func.lower(NewPartsSeoCard.brand))
        .order_by(func.count(NewPartsSeoCard.id).desc())
        .limit(limit)
        .all()
    )
    return [(row.display_brand, row.display_brand) for row in rows if row.display_brand]


def _top_categories_from_catalog(db: Session, limit: int = 10) -> list[tuple[int, str]]:
    rows = (
        db.query(
            PartType.id,
            PartType.name,
            func.count(Product.id).label("product_count"),
        )
        .join(Product, Product.part_type_id == PartType.id)
        .filter(func.coalesce(Product.quantity, 0) > 0)
        .group_by(PartType.id, PartType.name)
        .order_by(func.count(Product.id).desc())
        .limit(limit)
        .all()
    )
    return [(row.id, row.name) for row in rows if row.name]


def _top_brands_from_used_catalog(db: Session, limit: int = 10) -> list[tuple[str, str]]:
    rows = (
        db.query(
            func.lower(Product.brand).label("brand_key"),
            func.max(Product.brand).label("display_brand"),
            func.count(Product.id).label("product_count"),
        )
        .filter(
            func.coalesce(Product.quantity, 0) > 0,
            Product.brand.isnot(None),
            Product.brand != "",
        )
        .group_by(func.lower(Product.brand))
        .order_by(func.count(Product.id).desc())
        .limit(limit)
        .all()
    )
    return [(row.display_brand, row.display_brand) for row in rows if row.display_brand]


def _top_categories_from_used_catalog(db: Session, limit: int = 10) -> list[tuple[int, str]]:
    rows = (
        db.query(
            PartType.id,
            PartType.name,
            func.count(Product.id).label("product_count"),
        )
        .join(Product, Product.part_type_id == PartType.id)
        .filter(
            func.coalesce(Product.quantity, 0) > 0,
        )
        .group_by(PartType.id, PartType.name)
        .order_by(func.count(Product.id).desc())
        .limit(limit)
        .all()
    )
    return [(row.id, row.name) for row in rows if row.name]


def _load_seen_slugs(db: Session) -> dict[str, set[str]]:
    seen: dict[str, set[str]] = {}
    for kind, slug in db.query(SeoLandingPage.kind, SeoLandingPage.slug).all():
        seen.setdefault(kind, set()).add(slug)
    return seen


def _try_add_landing_row(
    db: Session,
    seen: dict[str, set[str]],
    *,
    kind: str,
    slug: str,
    row: SeoLandingPage,
) -> bool:
    if not slug:
        return False
    kind_seen = seen.setdefault(kind, set())
    if slug in kind_seen:
        return False
    db.add(row)
    kind_seen.add(slug)
    return True


def seed_landing_pages_from_catalog(db: Session, *, force: bool = False) -> SeoLandingSeedResult:
    result = SeoLandingSeedResult()
    existing_count = db.query(SeoLandingPage).count()
    if existing_count > 0 and not force:
        result.total_rows = existing_count
        result.skipped = existing_count
        return result

    created_brand = 0
    created_category = 0
    created_brand_used = 0
    created_category_used = 0
    created_geo = 0
    skipped = 0
    seen_slugs = _load_seen_slugs(db)

    for display_brand, brand_name in _top_brands_from_catalog(db):
        slug = slugify_brand(brand_name)
        if not slug:
            skipped += 1
            continue
        row = SeoLandingPage(
            kind="brand_new",
            slug=slug,
            title_ru=display_brand,
            brand_name=brand_name,
            is_active=True,
            priority=100,
        )
        if _try_add_landing_row(db, seen_slugs, kind="brand_new", slug=slug, row=row):
            created_brand += 1
        else:
            skipped += 1

    for part_type_id, name in _top_categories_from_catalog(db):
        slug = slugify(name)
        if not slug:
            skipped += 1
            continue
        row = SeoLandingPage(
            kind="category_new",
            slug=slug,
            title_ru=name,
            search_query=name.lower(),
            part_type_id=part_type_id,
            is_active=True,
            priority=50,
        )
        if _try_add_landing_row(db, seen_slugs, kind="category_new", slug=slug, row=row):
            created_category += 1
        else:
            skipped += 1

    for display_brand, brand_name in _top_brands_from_used_catalog(db):
        slug = slugify_brand(brand_name)
        if not slug:
            skipped += 1
            continue
        row = SeoLandingPage(
            kind="brand_used",
            slug=slug,
            title_ru=display_brand,
            brand_name=brand_name,
            is_active=True,
            priority=90,
        )
        if _try_add_landing_row(db, seen_slugs, kind="brand_used", slug=slug, row=row):
            created_brand_used += 1
        else:
            skipped += 1

    for part_type_id, name in _top_categories_from_used_catalog(db):
        slug = slugify(name)
        if not slug:
            skipped += 1
            continue
        row = SeoLandingPage(
            kind="category_used",
            slug=slug,
            title_ru=name,
            search_query=name.lower(),
            part_type_id=part_type_id,
            is_active=True,
            priority=45,
        )
        if _try_add_landing_row(db, seen_slugs, kind="category_used", slug=slug, row=row):
            created_category_used += 1
        else:
            skipped += 1

    geo_slug = slugify("Екатеринбург")
    if geo_slug:
        row = SeoLandingPage(
            kind="geo",
            slug=geo_slug,
            title_ru="Екатеринбург",
            city="Екатеринбург",
            is_active=True,
            priority=40,
        )
        if _try_add_landing_row(db, seen_slugs, kind="geo", slug=geo_slug, row=row):
            created_geo += 1
        else:
            skipped += 1

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise SeoLandingPageValidationError(
            "Конфликт уникальности при создании посадочных (дубликат slug). Повторите попытку."
        ) from exc
    result.created_brand_new = created_brand
    result.created_category_new = created_category
    result.created_brand_used = created_brand_used
    result.created_category_used = created_category_used
    result.created_geo = created_geo
    result.skipped = skipped
    result.total_rows = db.query(SeoLandingPage).count()
    return result
