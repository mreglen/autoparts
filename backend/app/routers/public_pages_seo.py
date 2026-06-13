from __future__ import annotations

import html
from urllib.parse import parse_qs, unquote, urlparse

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


def _parse_find_query_from_path(raw_path: str) -> str:
    parsed = urlparse(unquote((raw_path or "").strip()))
    path = parsed.path.rstrip("/") or "/"
    if path != "/find":
        return ""
    values = parse_qs(parsed.query).get("q") or []
    return (values[0] if values else "").strip()


def _resolve_find_target(db: Session, raw_path: str, *, site_origin: str):
    from app.services.search_resolve_service import resolve_search_query

    query = _parse_find_query_from_path(raw_path)
    if not query:
        return None
    return resolve_search_query(db, query, site_origin=site_origin)


class StaticPageSeoMetaResponse(BaseModel):
    title: str
    description: str
    canonical_url: str
    h1: str
    robots: str = "index, follow"
    keywords: str = ""


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
        keywords=meta.keywords,
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


@router.get("/public/find-redirect")
def public_find_redirect(
    path: str = Query(..., min_length=1, max_length=2048),
    db: Session = Depends(get_db),
):
    row = get_or_create_yandex_integration(db)
    site_origin = _resolve_site_origin(row.host_url)
    result = _resolve_find_target(db, path, site_origin=site_origin)
    if result is None:
        raise HTTPException(status_code=404, detail="Find query not found")
    return RedirectResponse(url=result.redirect_url, status_code=302)


@router.get("/public/find-prerender", response_class=HTMLResponse)
def public_find_prerender(
    path: str = Query(..., min_length=1, max_length=2048),
    db: Session = Depends(get_db),
):
    row = get_or_create_yandex_integration(db)
    site_origin = _resolve_site_origin(row.host_url)
    result = _resolve_find_target(db, path, site_origin=site_origin)
    if result is None:
        return HTMLResponse(
            content=render_not_found_html(title="404 — поиск не найден | Свой Гараж"),
            status_code=404,
            headers={"Cache-Control": "no-store"},
        )
    target = html.escape(result.redirect_url, quote=True)
    title = html.escape("Поиск запчастей | Свой Гараж", quote=True)
    return HTMLResponse(
        content=f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="robots" content="noindex, follow" />
  <title>{title}</title>
  <meta http-equiv="refresh" content="0;url={target}" />
  <link rel="canonical" href="{target}" />
</head>
<body>
  <p><a href="{target}">Перейти к результатам поиска</a></p>
</body>
</html>""",
        headers={"Cache-Control": "no-store"},
    )
