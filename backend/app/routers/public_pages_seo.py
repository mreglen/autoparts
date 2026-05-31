from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.static_page_seo_service import (
    get_seller_part_card_redirect_url,
    get_static_page_seo_for_path,
    render_static_page_prerender_html,
)
from app.services.spa_page_check_service import render_not_found_html
from app.services.yandex_feed_xml_service import _resolve_site_origin
from app.utils.yandex_integration_db import get_or_create_yandex_integration

router = APIRouter(tags=["Public pages SEO"])


class StaticPageSeoMetaResponse(BaseModel):
    title: str
    description: str
    canonical_url: str
    h1: str
    robots: str = "index, follow"


@router.get("/public/page-meta", response_model=StaticPageSeoMetaResponse)
def public_page_meta(
    path: str = Query(..., min_length=1, max_length=2048),
    db: Session = Depends(get_db),
):
    row = get_or_create_yandex_integration(db)
    site_origin = _resolve_site_origin(row.host_url)
    meta = get_static_page_seo_for_path(db, path, site_origin=site_origin)
    if meta is None:
        raise HTTPException(status_code=404, detail="Page SEO not found")
    return StaticPageSeoMetaResponse(
        title=meta.title,
        description=meta.description,
        canonical_url=meta.canonical_url,
        h1=meta.h1,
        robots=meta.robots,
    )


@router.get("/public/page-prerender", response_class=HTMLResponse)
def public_page_prerender(
    path: str = Query(..., min_length=1, max_length=2048),
    db: Session = Depends(get_db),
):
    row = get_or_create_yandex_integration(db)
    site_origin = _resolve_site_origin(row.host_url)

    redirect_url = get_seller_part_card_redirect_url(db, path, site_origin=site_origin)
    if redirect_url is not None:
        return RedirectResponse(url=redirect_url, status_code=301)

    meta = get_static_page_seo_for_path(db, path, site_origin=site_origin)
    if meta is None:
        return HTMLResponse(
            content=render_not_found_html(title="404 — страница не найдена | Свой Гараж"),
            status_code=404,
            headers={"Cache-Control": "no-store"},
        )
    return HTMLResponse(
        content=render_static_page_prerender_html(meta),
        headers={"Cache-Control": "public, max-age=300"},
    )
