from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.seo_landing_page import SeoLandingPage
from app.utils.slug_utils import slugify_brand


def _landing_link(row: SeoLandingPage) -> dict[str, str]:
    if row.kind == "brand_new":
        path = f"/autoparts/new/brand/{row.slug}"
        label = f"Новые {row.brand_name or row.title_ru}"
    elif row.kind == "brand_used":
        path = f"/autoparts/used/brand/{row.slug}"
        label = f"Б/у {row.brand_name or row.title_ru}"
    elif row.kind == "category_new":
        path = f"/autoparts/new/category/{row.slug}"
        label = f"Новые {row.title_ru}"
    elif row.kind == "category_used":
        path = f"/autoparts/used/category/{row.slug}"
        label = f"Б/у {row.title_ru}"
    elif row.kind == "geo":
        path = f"/autoparts/used/geo/{row.slug}"
        label = f"Б/у в {row.city or row.title_ru}"
    else:
        path = f"/seo/{row.kind}/{row.slug}"
        label = row.title_ru
    return {
        "kind": row.kind,
        "slug": row.slug,
        "label": label,
        "path": path,
        "title_ru": row.title_ru,
        "brand_name": row.brand_name,
    }


def _query_landings_excluding(
    db: Session,
    kind: str,
    *,
    exclude_slug: str | None = None,
    limit: int,
) -> list[SeoLandingPage]:
    query = db.query(SeoLandingPage).filter(
        SeoLandingPage.kind == kind,
        SeoLandingPage.is_active.is_(True),
    )
    if exclude_slug:
        query = query.filter(SeoLandingPage.slug != exclude_slug)
    return (
        query.order_by(SeoLandingPage.priority.desc(), SeoLandingPage.slug.asc())
        .limit(max(1, min(limit, 24)))
        .all()
    )


def _query_landings(db: Session, kind: str, *, limit: int) -> list[SeoLandingPage]:
    return _query_landings_excluding(db, kind, limit=limit)


def get_featured_landings(db: Session, *, limit: int = 8) -> dict[str, list[dict[str, str]]]:
    per_kind = max(2, min(limit, 12))
    return {
        "brands_new": [_landing_link(r) for r in _query_landings(db, "brand_new", limit=per_kind)],
        "brands_used": [_landing_link(r) for r in _query_landings(db, "brand_used", limit=per_kind)],
        "categories_new": [_landing_link(r) for r in _query_landings(db, "category_new", limit=per_kind)],
        "categories_used": [_landing_link(r) for r in _query_landings(db, "category_used", limit=per_kind)],
        "geo": [_landing_link(r) for r in _query_landings(db, "geo", limit=3)],
    }


def get_landing_crosslinks(db: Session, kind: str, slug: str, *, limit: int = 8) -> dict[str, object]:
    slug_text = (slug or "").strip()
    per_kind = max(2, min(limit, 12))
    result: dict[str, object] = {
        "kind": kind,
        "slug": slug_text,
        "counterpart": None,
        "categories": [],
        "brands": [],
        "geo": [],
        "related_categories": [],
    }

    if kind == "brand_new":
        result["counterpart"] = _find_landing(db, "brand_used", slug_text)
        result["categories"] = [_landing_link(r) for r in _query_landings(db, "category_new", limit=per_kind)]
    elif kind == "brand_used":
        result["counterpart"] = _find_landing(db, "brand_new", slug_text)
        result["categories"] = [_landing_link(r) for r in _query_landings(db, "category_used", limit=per_kind)]
        result["geo"] = [_landing_link(r) for r in _query_landings(db, "geo", limit=2)]
    elif kind == "category_new":
        result["counterpart"] = _find_landing(db, "category_used", slug_text)
        result["brands"] = [_landing_link(r) for r in _query_landings(db, "brand_new", limit=per_kind)]
        result["related_categories"] = [
            _landing_link(r)
            for r in _query_landings_excluding(db, "category_new", exclude_slug=slug_text, limit=per_kind)
        ]
    elif kind == "category_used":
        result["counterpart"] = _find_landing(db, "category_new", slug_text)
        result["brands"] = [_landing_link(r) for r in _query_landings(db, "brand_used", limit=per_kind)]
        result["geo"] = [_landing_link(r) for r in _query_landings(db, "geo", limit=2)]
        result["related_categories"] = [
            _landing_link(r)
            for r in _query_landings_excluding(db, "category_used", exclude_slug=slug_text, limit=per_kind)
        ]
    elif kind == "geo":
        result["brands"] = [_landing_link(r) for r in _query_landings(db, "brand_used", limit=per_kind)]
        result["categories"] = [_landing_link(r) for r in _query_landings(db, "category_used", limit=per_kind)]

    return result


def _find_landing(db: Session, kind: str, slug: str) -> dict[str, str] | None:
    row = (
        db.query(SeoLandingPage)
        .filter(
            SeoLandingPage.kind == kind,
            SeoLandingPage.slug == slug,
            SeoLandingPage.is_active.is_(True),
        )
        .first()
    )
    if row:
        return _landing_link(row)
    if kind.startswith("brand_"):
        from app.services.used_catalog_service import find_used_brand_name_by_slug
        from app.services.seo_landing_page_service import find_brand_name_by_slug

        brand_name = (
            find_used_brand_name_by_slug(db, slug)
            if kind == "brand_used"
            else find_brand_name_by_slug(db, slug)
        )
        if brand_name:
            section = "used" if kind == "brand_used" else "new"
            return {
                "kind": kind,
                "slug": slug,
                "label": brand_name,
                "path": f"/autoparts/{section}/brand/{slug}",
                "title_ru": brand_name,
                "brand_name": brand_name,
            }
    return None


def brand_slug_for_name(brand_name: str | None) -> str | None:
    slug = slugify_brand((brand_name or "").strip())
    return slug or None
