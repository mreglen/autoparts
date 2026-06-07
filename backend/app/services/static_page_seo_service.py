from __future__ import annotations

import html
import re
from dataclasses import dataclass
from urllib.parse import parse_qs, unquote, urlsplit, urlparse

from sqlalchemy.orm import Session, selectinload

from app.models.product import Product as ProductModel
from app.services.spa_page_check_service import PART_PATH_RE, _normalize_path
from app.services.yandex_feed_xml_service import _resolve_site_origin
from app.utils.product_display_name import format_product_display_title
from app.utils.product_urls import build_product_page_url
from app.utils.seo_constants import resolve_default_og_image_url

DEFAULT_SITE_ORIGIN = "https://svoygarage.ru"
SELLER_PART_CARD_RE = re.compile(r"^/seller/part-card/(?P<product_id>\d+)$")


@dataclass(frozen=True)
class StaticPageSeoMeta:
    title: str
    description: str
    canonical_url: str
    h1: str
    robots: str = "index, follow"


def _truncate(text: str, max_len: int) -> str:
    value = re.sub(r"\s+", " ", (text or "")).strip()
    if not value:
        return ""
    if len(value) <= max_len:
        return value
    return f"{value[: max_len - 1].strip()}…"


def _absolute_url(site_origin: str, path: str) -> str:
    origin = site_origin.rstrip("/")
    if not path or path == "/":
        return f"{origin}/"
    return f"{origin}{path if path.startswith('/') else f'/{path}'}"


def _build_home_seo(site_origin: str) -> StaticPageSeoMeta:
    canonical_url = _absolute_url(site_origin, "/")
    title = "Свой Гараж — автозапчасти новые и б/у"
    description = (
        "Маркетплейс автозапчастей «Свой Гараж»: поиск по артикулу и бренду, "
        "новые и б/у детали, доставка по России."
    )
    return StaticPageSeoMeta(
        title=title,
        description=description,
        canonical_url=canonical_url,
        h1="Найдите любую автозапчасть",
    )


def _build_catalog_seo(site_origin: str) -> StaticPageSeoMeta:
    canonical_url = _absolute_url(site_origin, "/catalog")
    title = "Каталог автозапчастей — новые и б/у | Свой Гараж"
    description = (
        "Каталог «Свой Гараж»: новые запчасти от поставщиков и б/у от продавцов. "
        "Поиск по артикулу, бренду и названию."
    )
    return StaticPageSeoMeta(
        title=title,
        description=description,
        canonical_url=canonical_url,
        h1="Все запчасти в одном месте",
    )


def _build_new_parts_seo(site_origin: str, query: str | None) -> StaticPageSeoMeta:
    from urllib.parse import quote

    q = (query or "").strip()
    if q:
        canonical_url = _absolute_url(site_origin, "/autoparts/new")
        title = f"{q} — новые запчасти | Свой Гараж"
        description = (
            f"Результаты поиска новых автозапчастей по запросу «{q}»: "
            "оригиналы и аналоги с доставкой по России."
        )
        h1 = f"Новые запчасти: {q}"
        robots = "noindex, follow"
    else:
        canonical_url = _absolute_url(site_origin, "/autoparts/new")
        title = "Новые автозапчасти с доставкой | Свой Гараж"
        description = (
            "Новые автозапчасти от поставщиков: поиск по артикулу и бренду, "
            "аналоги, сроки поставки и наличие на складах."
        )
        h1 = "Новые запчасти с доставкой"
        robots = "index, follow"
    return StaticPageSeoMeta(
        title=title,
        description=_truncate(description, 160),
        canonical_url=canonical_url,
        h1=h1,
        robots=robots,
    )


def _build_used_parts_seo(site_origin: str, query: str | None) -> StaticPageSeoMeta:
    q = (query or "").strip()
    if q:
        from urllib.parse import quote

        canonical_url = _absolute_url(site_origin, "/autoparts/used")
        title = f"{q} — б/у запчасти | Свой Гараж"
        description = (
            f"Результаты поиска б/у автозапчастей по запросу «{q}»: "
            "фото, описание и чат с продавцом."
        )
        h1 = f"Б/у запчасти: {q}"
        robots = "noindex, follow"
    else:
        canonical_url = _absolute_url(site_origin, "/autoparts/used")
        title = "Б/у автозапчасти — каталог продавцов | Свой Гараж"
        description = (
            "Каталог б/у автозапчастей от продавцов на «Свой Гараж»: "
            "разборки и магазины, фото, описание и общение с продавцом."
        )
        h1 = "Б/у автозапчасти"
        robots = "index, follow"
    return StaticPageSeoMeta(
        title=title,
        description=_truncate(description, 160),
        canonical_url=canonical_url,
        h1=h1,
        robots=robots,
    )


def _build_about_seo(site_origin: str) -> StaticPageSeoMeta:
    canonical_url = _absolute_url(site_origin, "/about")
    title = "О компании — Свой Гараж"
    description = (
        "ООО «Кроан» — оператор маркетплейса «Свой Гараж» в Екатеринбурге. "
        "Автозапчасти новые и б/у, доставка по России."
    )
    return StaticPageSeoMeta(
        title=title,
        description=description,
        canonical_url=canonical_url,
        h1="О компании",
    )


def _build_seller_part_card_seo(product: ProductModel, *, site_origin: str) -> StaticPageSeoMeta:
    brand = (product.brand or "").strip()
    article = (product.article or "").strip()
    name = format_product_display_title(brand, article, product.name)
    canonical_url = build_product_page_url(product, site_origin)
    title = f"{name} — карточка | Свой Гараж"
    condition = "новая" if product.is_new else "б/у"
    description = f"{condition.capitalize()} автозапчасть {name}. Карточка товара на «Свой Гараж»."
    return StaticPageSeoMeta(
        title=title,
        description=_truncate(description, 160),
        canonical_url=canonical_url,
        h1=name,
    )


def get_static_page_seo_for_path(
    db: Session | None,
    raw_path: str,
    *,
    site_origin: str | None = None,
) -> StaticPageSeoMeta | None:
    origin = _resolve_site_origin(site_origin or DEFAULT_SITE_ORIGIN)
    parsed = urlparse(unquote((raw_path or "").strip()))
    path = _normalize_path(parsed.path or "/")
    query_params = parse_qs(parsed.query)
    search_q = (query_params.get("q") or [None])[0]

    if path == "/":
        return _build_home_seo(origin)
    if path == "/catalog":
        return _build_catalog_seo(origin)
    if path == "/autoparts/new":
        return _build_new_parts_seo(origin, search_q)
    if path == "/autoparts/used":
        return _build_used_parts_seo(origin, search_q)
    if path == "/about":
        return _build_about_seo(origin)

    seller_match = SELLER_PART_CARD_RE.match(path)
    if seller_match and db is not None:
        product_id = int(seller_match.group("product_id"))
        product = (
            db.query(ProductModel)
            .options(selectinload(ProductModel.photos))
            .filter(ProductModel.id == product_id, ProductModel.quantity > 0)
            .first()
        )
        if product is not None:
            return _build_seller_part_card_seo(product, site_origin=origin)

    if PART_PATH_RE.match(path):
        return None

    return None


def get_seller_part_card_redirect_url(db: Session, raw_path: str, *, site_origin: str | None = None) -> str | None:
    origin = _resolve_site_origin(site_origin or DEFAULT_SITE_ORIGIN)
    parsed = urlparse(unquote((raw_path or "").strip()))
    path = _normalize_path(parsed.path or "/")
    seller_match = SELLER_PART_CARD_RE.match(path)
    if not seller_match:
        return None
    product_id = int(seller_match.group("product_id"))
    product = (
        db.query(ProductModel)
        .filter(ProductModel.id == product_id, ProductModel.quantity > 0)
        .first()
    )
    if product is None:
        return None
    return build_product_page_url(product, origin)


def render_static_page_prerender_html(meta: StaticPageSeoMeta) -> str:
    title = html.escape(meta.title, quote=True)
    description = html.escape(meta.description, quote=True)
    canonical = html.escape(meta.canonical_url, quote=True)
    h1 = html.escape(meta.h1)
    robots = html.escape(meta.robots, quote=True)
    body_desc = html.escape(meta.description)
    parsed = urlsplit(meta.canonical_url or "")
    page_origin = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else None
    og_image = html.escape(resolve_default_og_image_url(page_origin), quote=True)

    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="{robots}" />
  <title>{title}</title>
  <meta name="description" content="{description}" />
  <link rel="canonical" href="{canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Свой Гараж" />
  <meta property="og:title" content="{title}" />
  <meta property="og:description" content="{description}" />
  <meta property="og:url" content="{canonical}" />
  <meta property="og:locale" content="ru_RU" />
  <meta property="og:image" content="{og_image}" />
</head>
<body>
  <main>
    <h1>{h1}</h1>
    <p>{body_desc}</p>
    <p><a href="{canonical}">Открыть на «Свой Гараж»</a></p>
  </main>
</body>
</html>
"""
