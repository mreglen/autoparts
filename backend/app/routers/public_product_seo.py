from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.internal_access import require_internal_prerender
from app.services.product_reference_fitment_service import get_reference_fitment_vehicles
from app.services.product_seo_service import (
    get_product_seo_for_path,
    render_product_prerender_html,
    resolve_out_of_stock_part_redirect,
)
from app.services.new_parts_seo_card_service import (
    get_new_part_seo_for_path,
    render_new_part_prerender_html,
)
from app.services.spa_page_check_service import render_not_found_html
from app.utils.product_json_ld import dumps_json_ld
from app.utils.product_part_faq import build_product_faq_items, build_product_faq_json_ld

router = APIRouter(tags=["Public product SEO"])


class ProductFaqItemOut(BaseModel):
    question: str
    answer: str


class ProductSeoMetaResponse(BaseModel):
    title: str
    description: str
    canonical_url: str
    h1: str
    schema_name: str = ""
    image_url: str | None = None
    price: str | None = None
    in_stock: bool = True
    json_ld: str | None = None
    faq_items: list[ProductFaqItemOut] = []
    faq_json_ld: str | None = None
    keywords: str = ""
    seo_summary: str = ""
    body_description: str | None = None
    used_catalog_path: str = ""
    part_type_name: str = ""
    seller_name: str = ""
    seller_url: str = ""
    fitment_text: str = ""
    is_new: bool = False


class PartReferenceFitmentVehicleOut(BaseModel):
    brand: str
    model: str
    generation: str = ""
    source: str = "reference"


class PartReferenceFitmentResponse(BaseModel):
    vehicles: list[PartReferenceFitmentVehicleOut] = []


class NewPartSeoMetaResponse(BaseModel):
    title: str
    description: str
    canonical_url: str
    h1: str
    schema_name: str = ""
    image_url: str | None = None
    price: str | None = None
    in_stock: bool = True
    json_ld: str | None = None
    faq_items: list[ProductFaqItemOut] = []
    faq_json_ld: str | None = None
    keywords: str = ""
    seo_summary: str = ""
    body_description: str | None = None
    fitment_text: str = ""
    stock_summary: str = ""
    part_type_name: str = ""
    city: str = ""
    used_catalog_path: str = ""
    robots: str = "index, follow"
    warehouse_count: int = 0
    quantity: int = 0


@router.get("/public/part-meta", response_model=ProductSeoMetaResponse)
def public_part_meta(
    path: str = Query(..., min_length=1, max_length=2048),
    db: Session = Depends(get_db),
):
    """JSON-метаданные карточки товара для SEO и отладки."""
    meta = get_product_seo_for_path(db, path)
    if meta is None:
        raise HTTPException(status_code=404, detail="Product not found")
    is_new = meta.condition_label == "Новая"
    faq_items = build_product_faq_items(
        brand=meta.brand,
        article=meta.article,
        part_type_name=meta.part_type_name,
        is_new=is_new,
        city=meta.city,
        fitment_text=meta.fitment_text,
        in_stock=meta.in_stock,
        quantity=meta.quantity,
        price=meta.price,
    )
    faq_json_ld = build_product_faq_json_ld(
        canonical_url=meta.canonical_url,
        brand=meta.brand,
        article=meta.article,
        part_type_name=meta.part_type_name,
        is_new=is_new,
        city=meta.city,
        fitment_text=meta.fitment_text,
        in_stock=meta.in_stock,
        quantity=meta.quantity,
        price=meta.price,
    )
    return ProductSeoMetaResponse(
        title=meta.title,
        description=meta.description,
        canonical_url=meta.canonical_url,
        h1=meta.h1,
        schema_name=meta.schema_name,
        image_url=meta.image_url,
        price=meta.price,
        in_stock=meta.in_stock,
        json_ld=meta.json_ld or None,
        faq_items=[ProductFaqItemOut(**item) for item in faq_items],
        faq_json_ld=dumps_json_ld(faq_json_ld),
        keywords=meta.keywords,
        seo_summary=meta.seo_summary,
        body_description=meta.body_description,
        used_catalog_path=meta.used_catalog_path,
        part_type_name=meta.part_type_name,
        seller_name=meta.seller_name,
        seller_url=meta.seller_url,
        fitment_text=meta.fitment_text,
        is_new=is_new,
    )


@router.get("/public/part-reference-fitment", response_model=PartReferenceFitmentResponse)
def public_part_reference_fitment(
    brand: str = Query(..., min_length=1, max_length=120),
    article: str = Query(..., min_length=1, max_length=120),
    exclude_product_id: int | None = Query(None, ge=1),
    db: Session = Depends(get_db),
):
    vehicles = get_reference_fitment_vehicles(
        db,
        brand=brand,
        article=article,
        exclude_product_id=exclude_product_id,
    )
    return PartReferenceFitmentResponse(
        vehicles=[
            PartReferenceFitmentVehicleOut(
                brand=item.get("brand", ""),
                model=item.get("model", ""),
                generation=item.get("generation", ""),
                source=item.get("source", "reference"),
            )
            for item in vehicles
        ]
    )


@router.get("/public/part-prerender", response_class=HTMLResponse)
def public_part_prerender(
    path: str = Query(..., min_length=1, max_length=2048),
    db: Session = Depends(get_db),
    _: None = Depends(require_internal_prerender),
):
    """
    HTML с корректным &lt;title&gt; для поисковых роботов (Яндекс, Google).
    Nginx отдаёт этот ответ ботам вместо пустого index.html.
    """
    redirect_url = resolve_out_of_stock_part_redirect(db, path)
    if redirect_url:
        return RedirectResponse(url=redirect_url, status_code=301)

    meta = get_product_seo_for_path(db, path)
    if meta is None:
        return HTMLResponse(
            content=render_not_found_html(title="404 — запчасть не найдена | Свой Гараж"),
            status_code=404,
            headers={"Cache-Control": "no-store"},
        )
    return HTMLResponse(
        content=render_product_prerender_html(meta),
        headers={"Cache-Control": "public, max-age=300"},
    )


@router.get("/public/new-part-meta", response_model=NewPartSeoMetaResponse)
def public_new_part_meta(
    path: str = Query(..., min_length=1, max_length=2048),
    db: Session = Depends(get_db),
):
    meta = get_new_part_seo_for_path(db, path)
    if meta is None:
        raise HTTPException(status_code=404, detail="New part card not found")
    faq_items = build_product_faq_items(
        brand=meta.brand,
        article=meta.article,
        part_type_name=meta.part_type_name,
        is_new=True,
        city=meta.city,
        fitment_text=meta.fitment_text,
        in_stock=meta.in_stock,
        quantity=meta.quantity,
        price=meta.price,
        stock_summary=meta.stock_summary,
    )
    faq_json_ld = build_product_faq_json_ld(
        canonical_url=meta.canonical_url,
        brand=meta.brand,
        article=meta.article,
        part_type_name=meta.part_type_name,
        is_new=True,
        city=meta.city,
        fitment_text=meta.fitment_text,
        in_stock=meta.in_stock,
        quantity=meta.quantity,
        price=meta.price,
        stock_summary=meta.stock_summary,
    )
    used_catalog_path = ""
    if meta.used_catalog_url:
        from urllib.parse import urlparse

        parsed = urlparse(meta.used_catalog_url)
        used_catalog_path = parsed.path
        if parsed.query:
            used_catalog_path = f"{used_catalog_path}?{parsed.query}"
    return NewPartSeoMetaResponse(
        title=meta.title,
        description=meta.description,
        canonical_url=meta.canonical_url,
        h1=meta.h1,
        schema_name=meta.schema_name,
        image_url=meta.image_url,
        price=meta.price,
        in_stock=meta.in_stock,
        json_ld=meta.json_ld or meta.json_ld_graph or None,
        faq_items=[ProductFaqItemOut(**item) for item in faq_items],
        faq_json_ld=dumps_json_ld(faq_json_ld),
        keywords=meta.keywords,
        seo_summary=meta.seo_summary,
        body_description=meta.product_description,
        fitment_text=meta.fitment_text,
        stock_summary=meta.stock_summary,
        part_type_name=meta.part_type_name,
        city=meta.city,
        used_catalog_path=used_catalog_path,
        robots=meta.robots,
        warehouse_count=meta.warehouse_count,
        quantity=meta.quantity,
    )


@router.get("/public/new-part-prerender", response_class=HTMLResponse)
def public_new_part_prerender(
    path: str = Query(..., min_length=1, max_length=2048),
    db: Session = Depends(get_db),
    _: None = Depends(require_internal_prerender),
):
    meta = get_new_part_seo_for_path(db, path)
    if meta is None:
        return HTMLResponse(
            content=render_not_found_html(title="404 — карточка новой запчасти не найдена | Свой Гараж"),
            status_code=404,
            headers={"Cache-Control": "no-store"},
        )
    return HTMLResponse(
        content=render_new_part_prerender_html(meta),
        headers={"Cache-Control": "public, max-age=300"},
    )
