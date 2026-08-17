from __future__ import annotations

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.new_parts_seo_card import NewPartsSeoCard
from app.services.new_parts_seo_card_service import (
    _payload_from_raw,
    _stocks_from_card,
    aggregate_top_brands_in_category,
    build_new_part_card_path,
    create_or_get_new_part_card,
    find_active_new_part_card_by_brand_article,
    get_new_part_card,
    list_new_part_cards_by_brand,
    list_new_part_cards_by_category_slug,
    resolve_category_search_query,
)
from app.services.sitemap_service import try_refresh_new_parts_sitemap_for_card
from app.services.openverse_image_search_service import (
    ATTRIBUTION_KEY,
    resolve_new_part_card_image,
)
from app.utils.yandex_integration_db import get_or_create_yandex_integration

router = APIRouter(tags=["Public new parts cards"])


class NewPartStockIn(BaseModel):
    stock_id: str = Field(..., min_length=1, max_length=128)
    price: float | int | str | None = None
    available_count: int | None = 0
    delivery_start: str | None = None
    delivery_end: str | None = None


class NewPartCardCreateIn(BaseModel):
    source: str = Field(default="rossko", max_length=32)
    supplier_stock_id: str | None = Field(default=None, max_length=128)
    brand: str = Field(..., min_length=1, max_length=120)
    article: str = Field(..., min_length=1, max_length=120)
    name: str | None = Field(default=None, max_length=512)
    description: str | None = None
    price: float | int | str | None = None
    currency: str = Field(default="RUB", max_length=8)
    stock_count: int | None = None
    delivery_start: str | None = None
    delivery_end: str | None = None
    image_url: str | None = None
    guid: str | None = Field(default=None, max_length=128)
    stocks: list[NewPartStockIn] | None = None


class NewPartStockOut(BaseModel):
    stock_id: str
    price: float | None = None
    available_count: int = 0
    delivery_start: str | None = None
    delivery_end: str | None = None


class NewPartCardImageOut(BaseModel):
    image_url: str | None = None
    image_attribution: str | None = None


class NewPartCardResolveOut(BaseModel):
    card_id: int
    canonical_url: str


class NewPartCardOut(BaseModel):
    id: int
    source: str
    brand: str
    article: str
    name: str | None = None
    description: str | None = None
    price: float | None = None
    currency: str
    stock_count: int | None = None
    delivery_start: str | None = None
    delivery_end: str | None = None
    image_url: str | None = None
    image_attribution: str | None = None
    guid: str | None = None
    supplier_stock_id: str | None = None
    stocks: list[NewPartStockOut] = Field(default_factory=list)
    canonical_url: str


class PopularBrandOut(BaseModel):
    brand: str
    slug: str
    count: int


class NewPartCardListOut(BaseModel):
    items: list[NewPartCardOut]
    total: int
    page: int
    page_size: int
    popular_brands: list[PopularBrandOut] = Field(default_factory=list)


def _card_to_out(card: NewPartsSeoCard) -> NewPartCardOut:
    payload = _payload_from_raw(card)
    stocks = [
        NewPartStockOut(
            stock_id=row["stock_id"],
            price=row.get("price"),
            available_count=int(row.get("available_count") or 0),
            delivery_start=row.get("delivery_start"),
            delivery_end=row.get("delivery_end"),
        )
        for row in _stocks_from_card(card)
    ]
    return NewPartCardOut(
        id=card.id,
        source=card.source,
        brand=card.brand,
        article=card.article,
        name=card.name,
        description=card.description,
        price=float(card.price) if card.price is not None else None,
        currency=card.currency or "RUB",
        stock_count=card.stock_count,
        delivery_start=card.delivery_start.isoformat() if card.delivery_start else None,
        delivery_end=card.delivery_end.isoformat() if card.delivery_end else None,
        image_url=card.image_url,
        image_attribution=payload.get(ATTRIBUTION_KEY)
        if isinstance(payload.get(ATTRIBUTION_KEY), str)
        else None,
        guid=payload.get("guid") if isinstance(payload.get("guid"), str) else None,
        supplier_stock_id=payload.get("supplier_stock_id")
        if isinstance(payload.get("supplier_stock_id"), str)
        else None,
        stocks=stocks,
        canonical_url=build_new_part_card_path(card.id, card.brand, card.article),
    )


@router.get("/public/new-parts/cards", response_model=NewPartCardListOut)
def public_list_new_part_cards(
    brand: str | None = Query(None, min_length=1, max_length=120),
    category_slug: str | None = Query(None, min_length=1, max_length=120),
    page: int = Query(1, ge=1),
    page_size: int = Query(48, ge=1, le=100),
    db: Session = Depends(get_db),
):
    has_brand = bool((brand or "").strip())
    has_category = bool((category_slug or "").strip())
    if has_brand == has_category:
        raise HTTPException(
            status_code=422,
            detail="Укажите ровно один параметр: brand или category_slug",
        )

    if has_category:
        if resolve_category_search_query(db, category_slug) is None:
            raise HTTPException(status_code=404, detail="Категория не найдена")
        rows, total = list_new_part_cards_by_category_slug(
            db,
            category_slug,
            page=page,
            page_size=page_size,
        )
        popular_brands = [
            PopularBrandOut(**row)
            for row in aggregate_top_brands_in_category(db, category_slug)
        ]
    else:
        rows, total = list_new_part_cards_by_brand(db, brand, page=page, page_size=page_size)
        popular_brands = []

    return NewPartCardListOut(
        items=[_card_to_out(card) for card in rows],
        total=total,
        page=page,
        page_size=page_size,
        popular_brands=popular_brands,
    )


@router.get("/public/new-parts/cards/resolve", response_model=NewPartCardResolveOut)
def public_resolve_new_part_card(
    brand: str = Query(..., min_length=1, max_length=120),
    article: str = Query(..., min_length=1, max_length=120),
    db: Session = Depends(get_db),
):
    card = find_active_new_part_card_by_brand_article(db, brand, article)
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    integration = get_or_create_yandex_integration(db)
    from app.services.yandex_feed_xml_service import _resolve_site_origin

    origin = _resolve_site_origin(integration.host_url)
    path = build_new_part_card_path(card.id, card.brand, card.article)
    return NewPartCardResolveOut(
        card_id=int(card.id),
        canonical_url=f"{origin}{path}",
    )


@router.post("/public/new-parts/cards/create-or-get", response_model=NewPartCardOut)
def public_create_or_get_new_part_card(payload: NewPartCardCreateIn, db: Session = Depends(get_db)):
    card = create_or_get_new_part_card(db, payload.model_dump())
    integration = get_or_create_yandex_integration(db)
    try_refresh_new_parts_sitemap_for_card(db, card, preferred_host_url=integration.host_url)
    return _card_to_out(card)


@router.get("/public/new-parts/cards/{card_id}", response_model=NewPartCardOut)
def public_get_new_part_card(card_id: int, db: Session = Depends(get_db)):
    card = get_new_part_card(db, card_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    return _card_to_out(card)


@router.post("/public/new-parts/cards/{card_id}/resolve-image", response_model=NewPartCardImageOut)
def public_resolve_new_part_card_image(card_id: int, db: Session = Depends(get_db)):
    card = get_new_part_card(db, card_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    try:
        image_url = resolve_new_part_card_image(db, card)
    except Exception:
        return NewPartCardImageOut(image_url=None)
    payload = _payload_from_raw(card)
    attribution = payload.get(ATTRIBUTION_KEY)
    return NewPartCardImageOut(
        image_url=image_url,
        image_attribution=attribution if isinstance(attribution, str) else None,
    )
