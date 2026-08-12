from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import quote

from sqlalchemy.orm import Session

from app.services.laximo.gate import laximo_cat_ready
from app.services.laximo.vin import looks_like_vin, normalize_vin_for_search_or_none
from app.services.new_parts_seo_card_service import (
    build_new_part_card_path,
    find_active_new_part_card_by_brand_article,
)
from app.services.used_catalog_service import find_indexable_used_catalog_product
from app.utils.product_urls import build_used_catalog_url_for_query
from app.utils.search_query import parse_search_query


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

    vin = normalize_vin_for_search_or_none(trimmed)
    if vin and looks_like_vin(vin):
        if laximo_cat_ready(db):
            redirect_path = f"/autoparts/vin?vin={quote(vin, safe='')}"
            return ResolveSearchResult(
                status="redirect",
                redirect_path=redirect_path,
                redirect_url=f"{origin}{redirect_path}",
                match_type="vin_catalog",
            )
        # Not ready: soft fallback to used listing with VIN as text query
        fallback_path = f"/autoparts/used?q={quote(vin, safe='')}&vin_unavailable=1"
        return ResolveSearchResult(
            status="fallback",
            redirect_path=fallback_path,
            redirect_url=f"{origin}{fallback_path}",
            match_type="vin_unavailable",
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

    parsed = parse_search_query(trimmed)
    for brand, article in parsed.brand_article_pairs[:8]:
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
