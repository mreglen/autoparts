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

router = APIRouter(tags=["Public product SEO"])


class ProductSeoMetaResponse(BaseModel):
    title: str
    description: str
    canonical_url: str
    h1: str
    image_url: str | None = None
    price: str | None = None
    in_stock: bool = True
    json_ld: str | None = None
    keywords: str = ""
    seo_summary: str = ""
    body_description: str | None = None
    used_catalog_path: str = ""
    part_type_name: str = ""
    seller_name: str = ""
    seller_url: str = ""
    fitment_text: str = ""


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
    image_url: str | None = None
    price: str | None = None
    in_stock: bool = True
    json_ld: str | None = None
    keywords: str = ""


@router.get("/public/part-meta", response_model=ProductSeoMetaResponse)
def public_part_meta(
    path: str = Query(..., min_length=1, max_length=2048),
    db: Session = Depends(get_db),
):
    """JSON-метаданные карточки товара для SEO и отладки."""
    meta = get_product_seo_for_path(db, path)
    if meta is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return ProductSeoMetaResponse(
        title=meta.title,
        description=meta.description,
        canonical_url=meta.canonical_url,
        h1=meta.h1,
        image_url=meta.image_url,
        price=meta.price,
        in_stock=meta.in_stock,
        json_ld=meta.json_ld or None,
        keywords=meta.keywords,
        seo_summary=meta.seo_summary,
        body_description=meta.body_description,
        used_catalog_path=meta.used_catalog_path,
        part_type_name=meta.part_type_name,
        seller_name=meta.seller_name,
        seller_url=meta.seller_url,
        fitment_text=meta.fitment_text,
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
    return NewPartSeoMetaResponse(
        title=meta.title,
        description=meta.description,
        canonical_url=meta.canonical_url,
        h1=meta.h1,
        image_url=meta.image_url,
        price=meta.price,
        in_stock=meta.in_stock,
        json_ld=meta.json_ld or meta.json_ld_graph or None,
        keywords=meta.keywords,
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
