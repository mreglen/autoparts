from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.product_seo_service import (
    get_product_seo_for_path,
    render_product_prerender_html,
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
        json_ld=meta.json_ld_graph,
        keywords=meta.keywords,
    )


@router.get("/public/part-prerender", response_class=HTMLResponse)
def public_part_prerender(
    path: str = Query(..., min_length=1, max_length=2048),
    db: Session = Depends(get_db),
):
    """
    HTML с корректным &lt;title&gt; для поисковых роботов (Яндекс, Google).
    Nginx отдаёт этот ответ ботам вместо пустого index.html.
    """
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
        json_ld=meta.json_ld,
        keywords=meta.keywords,
    )


@router.get("/public/new-part-prerender", response_class=HTMLResponse)
def public_new_part_prerender(
    path: str = Query(..., min_length=1, max_length=2048),
    db: Session = Depends(get_db),
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
