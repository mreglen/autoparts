from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import quote

from sqlalchemy.orm import Session

from app.services.new_parts_seo_card_service import (
    build_new_part_card_path,
    find_active_new_part_card_by_brand_article,
)
from app.services.used_catalog_service import find_indexable_used_catalog_product
from app.utils.product_urls import build_used_catalog_url_for_query
from app.utils.search_query import parse_brand_article_from_query


@dataclass(frozen=True)
class ResolveSearchResult:
    status: str
    redirect_path: str
    redirect_url: str
    match_type: str | None = None


def resolve_search_query(db: Session, q: str, *, site_origin: str) -> ResolveSearchResult:
    trimmed = (q or "").strip()
    origin = site_origin.rstrip("/")

    if not trimmed:
        return ResolveSearchResult(
            status="fallback",
            redirect_path="/autoparts/used",
            redirect_url=f"{origin}/autoparts/used",
            match_type=None,
        )

    indexable = find_indexable_used_catalog_product(db, trimmed)
    if indexable is not None:
        redirect_path = f"/autoparts/used?q={quote(trimmed, safe='')}"
        return ResolveSearchResult(
            status="redirect",
            redirect_path=redirect_path,
            redirect_url=f"{origin}{redirect_path}",
            match_type=indexable[1],
        )

    parsed = parse_brand_article_from_query(trimmed)
    if parsed is not None:
        brand, article = parsed
        card = find_active_new_part_card_by_brand_article(db, brand, article)
        if card is not None:
            redirect_path = build_new_part_card_path(int(card.id), card.brand, card.article)
            return ResolveSearchResult(
                status="redirect",
                redirect_path=redirect_path,
                redirect_url=f"{origin}{redirect_path}",
                match_type="new_part_card",
            )

    fallback_path = f"/autoparts/used?q={quote(trimmed, safe='')}"
    return ResolveSearchResult(
        status="fallback",
        redirect_path=fallback_path,
        redirect_url=build_used_catalog_url_for_query(origin, trimmed),
        match_type="listing",
    )
