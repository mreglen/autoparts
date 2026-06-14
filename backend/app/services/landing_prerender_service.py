from __future__ import annotations

import html
import json
from typing import Any

from sqlalchemy.orm import Session

from app.schemas.seo_landing_page import SeoLandingResolveOut
from app.services.landing_page_content_service import (
    build_landing_content,
    render_faq_html,
    render_popular_queries_html,
)
from app.services.seo_crosslinks_service import get_landing_crosslinks


def build_breadcrumb_items_for_landing(kind: str, landing: SeoLandingResolveOut) -> list[dict[str, str | None]]:
    items: list[dict[str, str | None]] = [{"label": "Главная", "href": "/"}]
    brand = (landing.brand_name or landing.title_ru or "").strip()
    title = (landing.title_ru or "").strip()
    city = (landing.city or landing.title_ru or "").strip()

    if kind == "brand_new":
        items.append({"label": "Новые запчасти", "href": "/autoparts/new"})
        items.append({"label": brand, "href": None})
    elif kind == "category_new":
        items.append({"label": "Новые запчасти", "href": "/autoparts/new"})
        items.append({"label": title, "href": None})
    elif kind == "brand_used":
        items.append({"label": "Б/у запчасти", "href": "/autoparts/used"})
        items.append({"label": brand, "href": None})
    elif kind == "category_used":
        items.append({"label": "Б/у запчасти", "href": "/autoparts/used"})
        items.append({"label": title, "href": None})
    elif kind == "geo":
        items.append({"label": "Б/у запчасти", "href": "/autoparts/used"})
        items.append({"label": city, "href": None})
    return items


def build_breadcrumb_json_ld_for_landing(
    kind: str,
    landing: SeoLandingResolveOut,
    *,
    site_origin: str,
) -> str:
    items = build_breadcrumb_items_for_landing(kind, landing)
    origin = site_origin.rstrip("/")
    entities = []
    for index, item in enumerate(items, start=1):
        entry: dict[str, Any] = {
            "@type": "ListItem",
            "position": index,
            "name": item["label"],
        }
        if item.get("href"):
            href = item["href"]
            entry["item"] = f"{origin}{href if href.startswith('/') else f'/{href}'}"
        entities.append(entry)
    return json.dumps(
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": entities},
        ensure_ascii=False,
    )


def _render_crosslinks_html(crosslinks: dict[str, Any]) -> str:
    sections: list[str] = []
    counterpart = crosslinks.get("counterpart")
    if counterpart:
        sections.append(
            f'<p><a href="{html.escape(counterpart["path"])}">{html.escape(counterpart["label"])}</a></p>'
        )

    def link_list(title: str, items: list[dict[str, str]] | None) -> str:
        if not items:
            return ""
        lis = "".join(
            f'<li><a href="{html.escape(item["path"])}">{html.escape(item["label"])}</a></li>'
            for item in items
        )
        return f"<h2>{html.escape(title)}</h2><ul>{lis}</ul>"

    sections.append(link_list("Бренды", crosslinks.get("brands")))
    sections.append(link_list("Категории", crosslinks.get("categories")))
    sections.append(link_list("Гео", crosslinks.get("geo")))
    sections.append(link_list("Похожие категории", crosslinks.get("related_categories")))
    body = "".join(s for s in sections if s)
    if not body:
        return ""
    return f'<nav aria-label="Смежные разделы">{body}</nav>'


def build_landing_prerender_supplements(
    db: Session,
    *,
    kind: str,
    slug: str,
    landing: SeoLandingResolveOut,
    total_count: int,
    top_items: list[Any],
    site_origin: str,
) -> dict[str, str]:
    is_new = kind in ("brand_new", "category_new")
    content = build_landing_content(
        landing,
        kind=kind,
        total_count=total_count,
        top_items=top_items,
        is_new=is_new,
        site_origin=site_origin,
    )
    crosslinks = get_landing_crosslinks(db, kind, slug, limit=8)

    about_block = ""
    if content.about_html:
        about_block = f'<section><h2>О разделе</h2>{content.about_html}</section>'
    order_block = ""
    if content.order_delivery_html:
        order_block = f'<section><h2>Заказ и доставка</h2>{content.order_delivery_html}</section>'

    content_sections_html = about_block + order_block
    faq_html = render_faq_html(content.faq_items)
    popular_queries_html = render_popular_queries_html(content.popular_queries)
    crosslinks_html = _render_crosslinks_html(crosslinks)
    breadcrumb_json_ld = build_breadcrumb_json_ld_for_landing(kind, landing, site_origin=site_origin)

    json_ld_parts: list[str] = []
    if breadcrumb_json_ld:
        json_ld_parts.append(breadcrumb_json_ld)
    if content.faq_json_ld:
        json_ld_parts.append(content.faq_json_ld)

    return {
        "content_sections_html": content_sections_html,
        "faq_html": faq_html,
        "popular_queries_html": popular_queries_html,
        "crosslinks_html": crosslinks_html,
        "json_ld": "\n".join(json_ld_parts),
    }
