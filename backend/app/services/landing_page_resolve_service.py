from __future__ import annotations

from sqlalchemy.orm import Session

from app.schemas.seo_landing_page import (
    LandingContentOut,
    LandingFaqItemOut,
    LandingPopularQueryOut,
    SeoLandingResolveOut,
)
from app.services.landing_page_content_service import build_landing_content
from app.services.new_parts_seo_card_service import iter_new_part_cards_by_brand_for_prerender, iter_new_part_cards_by_category_for_prerender
from app.services.used_catalog_service import (
    iter_used_products_by_brand_for_prerender,
    iter_used_products_by_city_for_prerender,
    iter_used_products_by_part_type_for_prerender,
)


def fetch_landing_top_items(db: Session, kind: str, resolved: SeoLandingResolveOut, *, limit: int = 12) -> list:
    if kind == "brand_new":
        brand = resolved.brand_name or resolved.title_ru
        return list(iter_new_part_cards_by_brand_for_prerender(db, brand, limit=limit)) if brand else []
    if kind == "category_new":
        return list(iter_new_part_cards_by_category_for_prerender(db, resolved.slug, limit=limit))
    if kind == "brand_used":
        brand = resolved.brand_name or resolved.title_ru
        return list(iter_used_products_by_brand_for_prerender(db, brand, limit=limit)) if brand else []
    if kind == "category_used":
        return list(iter_used_products_by_part_type_for_prerender(db, resolved.part_type_id, limit=limit))
    if kind == "geo":
        city = resolved.city or resolved.title_ru
        return list(iter_used_products_by_city_for_prerender(db, city, limit=limit)) if city else []
    return []


def attach_landing_content(
    db: Session,
    resolved: SeoLandingResolveOut,
    *,
    kind: str,
    total_count: int = 0,
) -> SeoLandingResolveOut:
    is_new = kind in ("brand_new", "category_new")
    top_items = fetch_landing_top_items(db, kind, resolved)
    content = build_landing_content(
        resolved,
        kind=kind,
        total_count=total_count,
        top_items=top_items,
        is_new=is_new,
    )
    content_out = LandingContentOut(
        about_html=content.about_html,
        order_delivery_html=content.order_delivery_html,
        faq_items=[LandingFaqItemOut(question=i.question, answer=i.answer) for i in content.faq_items],
        popular_queries=[LandingPopularQueryOut(label=q.label, path=q.path) for q in content.popular_queries],
        faq_json_ld=content.faq_json_ld,
    )
    return resolved.model_copy(update={"content": content_out})
