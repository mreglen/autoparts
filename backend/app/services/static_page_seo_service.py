from __future__ import annotations

import html
import json
import re
from dataclasses import dataclass
from urllib.parse import parse_qs, unquote, urlsplit, urlparse

from sqlalchemy.orm import Session, selectinload

from app.models.organization import Organization as OrganizationModel
from app.models.product import Product as ProductModel
from app.services.spa_page_check_service import PART_PATH_RE, _normalize_path
from app.services.yandex_feed_xml_service import _resolve_site_origin
from app.utils.page_keywords import build_page_keywords
from app.utils.product_display_name import format_product_display_title
from app.utils.product_urls import build_product_page_url, build_product_used_catalog_url
from app.utils.seo_constants import resolve_default_og_image_url

DEFAULT_SITE_ORIGIN = "https://svoygarage.ru"
SELLER_PART_CARD_RE = re.compile(r"^/seller/part-card/(?P<product_id>\d+)$")
NEW_BRAND_LANDING_RE = re.compile(r"^/autoparts/new/brand/(?P<slug>[^/]+)$")
NEW_CATEGORY_LANDING_RE = re.compile(r"^/autoparts/new/category/(?P<slug>[^/]+)$")
USED_BRAND_LANDING_RE = re.compile(r"^/autoparts/used/brand/(?P<slug>[^/]+)$")
USED_CATEGORY_LANDING_RE = re.compile(r"^/autoparts/used/category/(?P<slug>[^/]+)$")
USED_GEO_LANDING_RE = re.compile(r"^/autoparts/used/geo/(?P<slug>[^/]+)$")
ORGANIZATION_DETAIL_RE = re.compile(r"^/organizations/(?P<org_id>[A-Za-z0-9_-]+)$")


@dataclass(frozen=True)
class StaticPageSeoMeta:
    title: str
    description: str
    canonical_url: str
    h1: str
    robots: str = "index, follow"
    keywords: str = ""
    card_links: tuple[tuple[str, str], ...] = ()
    json_ld: str = ""
    content_sections_html: str = ""
    faq_html: str = ""
    popular_queries_html: str = ""
    crosslinks_html: str = ""


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


def _build_home_json_ld(site_origin: str) -> str:
    return json.dumps(
        {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Свой Гараж",
            "url": site_origin,
            "description": (
                "Маркетплейс автозапчастей «Свой Гараж»: поиск по артикулу и бренду, "
                "новые и б/у детали, доставка по России."
            ),
            "potentialAction": {
                "@type": "SearchAction",
                "target": {
                    "@type": "EntryPoint",
                    "urlTemplate": f"{site_origin}/find?q={{search_term_string}}",
                },
                "query-input": "required name=search_term_string",
            },
        },
        ensure_ascii=False,
    )


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
        json_ld=_build_home_json_ld(site_origin.rstrip("/")),
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


def _build_new_parts_seo(
    site_origin: str,
    query: str | None,
    *,
    brands: list[str] | None = None,
) -> StaticPageSeoMeta:
    from app.services.seo_semantics_service import resolve_single_brand_landing_path

    q = (query or "").strip()
    brand_list = [b.strip() for b in (brands or []) if b and str(b).strip()]
    brand_landing_path = resolve_single_brand_landing_path("new", brand_list, has_text_query=bool(q))
    has_filters = bool(q or brand_list)

    if has_filters:
        title_suffix_parts = []
        if brand_list:
            title_suffix_parts.append(f"бренд: {', '.join(brand_list[:2])}")
        title_suffix = f" ({'; '.join(title_suffix_parts)})" if title_suffix_parts else ""
        query_label = q or "фильтр"
        canonical_path = brand_landing_path or "/autoparts/new"
        title = f"{query_label}{title_suffix} — новые запчасти | Свой Гараж"
        description = (
            f"Результаты поиска новых автозапчастей по запросу «{query_label}»: "
            "оригиналы и аналоги с доставкой по России."
        )
        h1 = f"Новые запчасти: {query_label}"
        robots = "noindex, follow"
    else:
        canonical_path = "/autoparts/new"
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
        canonical_url=_absolute_url(site_origin, canonical_path),
        h1=h1,
        robots=robots,
    )


def _used_parts_query_is_q_only(query_params: dict) -> bool:
    allowed = {"q"}
    if set(query_params.keys()) - allowed:
        return False
    q = (query_params.get("q") or [None])[0]
    return bool((q or "").strip())


def _build_used_parts_seo(
    site_origin: str,
    query: str | None,
    *,
    brands: list[str] | None = None,
    db: Session | None = None,
) -> StaticPageSeoMeta:
    from app.services.seo_semantics_service import resolve_single_brand_landing_path
    from app.services.used_catalog_service import find_indexable_used_catalog_product

    q = (query or "").strip()
    brand_list = [b.strip() for b in (brands or []) if b and str(b).strip()]

    if q and not brand_list and db is not None:
        indexable = find_indexable_used_catalog_product(db, q)
        if indexable is not None:
            product, _match_type = indexable
            brand = (product.brand or "").strip()
            article = (product.article or "").strip()
            name = format_product_display_title(brand, article, product.name)
            canonical_url = build_product_used_catalog_url(product, site_origin)
            part_url = build_product_page_url(product, site_origin)
            condition = "новая" if product.is_new else "б/у"
            return StaticPageSeoMeta(
                title=f"{name} — б/у запчасти | Свой Гараж",
                description=_truncate(
                    f"{condition.capitalize()} автозапчасть {name}. "
                    "Фото, описание и чат с продавцом на «Свой Гараж».",
                    160,
                ),
                canonical_url=canonical_url,
                h1=name,
                robots="index, follow",
                keywords=build_page_keywords("used_catalog_q", brand=brand, article=article),
                card_links=((name, part_url),),
            )

    brand_landing_path = resolve_single_brand_landing_path("used", brand_list, has_text_query=bool(q))
    has_filters = bool(q or brand_list)

    if has_filters:
        title_suffix = f" (бренд: {', '.join(brand_list[:2])})" if brand_list else ""
        query_label = q or "фильтр"
        canonical_path = brand_landing_path or "/autoparts/used"
        title = f"{query_label}{title_suffix} — б/у запчасти | Свой Гараж"
        description = (
            f"Результаты поиска б/у автозапчастей по запросу «{query_label}»: "
            "фото, описание и чат с продавцом."
        )
        h1 = f"Б/у запчасти: {query_label}"
        robots = "noindex, follow"
    else:
        canonical_path = "/autoparts/used"
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
        canonical_url=_absolute_url(site_origin, canonical_path),
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


def _build_delivery_seo(site_origin: str) -> StaticPageSeoMeta:
    canonical_url = _absolute_url(site_origin, "/delivery")
    title = "Доставка автозапчастей — условия и регионы | Свой Гараж"
    description = (
        "Условия доставки «Свой Гараж»: самовывоз и ПВЗ, регионы доставки, "
        "минимальная сумма и службы доставки."
    )
    return StaticPageSeoMeta(
        title=title,
        description=description,
        canonical_url=canonical_url,
        h1="Доставка",
    )


def _build_autoparts_redirect_seo(site_origin: str) -> StaticPageSeoMeta:
    canonical_url = _absolute_url(site_origin, "/autoparts/new")
    title = "Автозапчасти — новые и б/у | Свой Гараж"
    description = (
        "Каталог автозапчастей на «Свой Гараж»: новые запчасти с доставкой "
        "и б/у от продавцов. Поиск по артикулу и бренду."
    )
    return StaticPageSeoMeta(
        title=title,
        description=description,
        canonical_url=canonical_url,
        h1="Автозапчасти",
    )


def _build_payment_seo(site_origin: str) -> StaticPageSeoMeta:
    canonical_url = _absolute_url(site_origin, "/payment")
    title = "Оплата заказов — способы и условия | Свой Гараж"
    description = (
        "Способы оплаты заказов в «Свой Гараж»: перевод, наличные при получении "
        "и онлайн-оплата. Условия покупки — в публичной оферте."
    )
    return StaticPageSeoMeta(
        title=title,
        description=description,
        canonical_url=canonical_url,
        h1="Оплата",
    )


def _build_reviews_seo(site_origin: str) -> StaticPageSeoMeta:
    canonical_url = _absolute_url(site_origin, "/reviews")
    title = "Отзывы — Свой Гараж"
    description = (
        "Отзывы покупателей и партнёров о магазине «Свой Гараж»: подбор запчастей, "
        "доставка, чаты с продавцами и работа платформы."
    )
    return StaticPageSeoMeta(
        title=title,
        description=description,
        canonical_url=canonical_url,
        h1="Отзывы о «Свой Гараж»",
    )


def _build_cookie_policy_seo(site_origin: str) -> StaticPageSeoMeta:
    canonical_url = _absolute_url(site_origin, "/cookie-policy")
    title = "Политика обработки cookie | Свой Гараж"
    description = "Информация об использовании файлов cookie на сайте «Свой Гараж»."
    return StaticPageSeoMeta(
        title=title,
        description=description,
        canonical_url=canonical_url,
        h1="Политика обработки cookie",
    )


def _build_privacy_seo(site_origin: str) -> StaticPageSeoMeta:
    canonical_url = _absolute_url(site_origin, "/privacy")
    title = "Политика конфиденциальности | Свой Гараж"
    description = "Политика конфиденциальности интернет-магазина «Свой Гараж»."
    return StaticPageSeoMeta(
        title=title,
        description=description,
        canonical_url=canonical_url,
        h1="Политика конфиденциальности",
    )


def _build_offer_seo(site_origin: str) -> StaticPageSeoMeta:
    canonical_url = _absolute_url(site_origin, "/offer")
    title = "Публичная оферта | Свой Гараж"
    description = "Условия покупки товаров в интернет-магазине «Свой Гараж»."
    return StaticPageSeoMeta(
        title=title,
        description=description,
        canonical_url=canonical_url,
        h1="Публичная оферта",
    )


def _build_personal_data_consent_seo(site_origin: str) -> StaticPageSeoMeta:
    canonical_url = _absolute_url(site_origin, "/personal-data-consent")
    title = "Согласие на обработку персональных данных | Свой Гараж"
    description = "Согласие пользователя на обработку персональных данных на сайте «Свой Гараж»."
    return StaticPageSeoMeta(
        title=title,
        description=description,
        canonical_url=canonical_url,
        h1="Согласие на обработку персональных данных",
    )


def _build_organization_detail_seo(db: Session, org_id: str, *, site_origin: str) -> StaticPageSeoMeta | None:
    org = db.query(OrganizationModel).filter(OrganizationModel.id == org_id).first()
    if org is None:
        return None

    name = (org.name or "").strip() or "Организация"
    path = f"/organizations/{org_id}"
    canonical_url = _absolute_url(site_origin, path)
    description_raw = (org.description or "").strip() or " — ".join(
        part for part in (name, org.address, "телефон для связи" if org.phone else None) if part
    )
    description = _truncate(description_raw, 160)
    title = f"{name} — организация | Свой Гараж"
    logo = (org.logo_organization or "").strip()
    if logo.startswith("http"):
        image_url = logo
    elif logo:
        image_url = _absolute_url(site_origin, logo if logo.startswith("/") else f"/{logo}")
    else:
        image_url = _absolute_url(site_origin, "/img/LogoWithoutBg.png")

    json_ld = json.dumps(
        {
            "@context": "https://schema.org",
            "@type": "AutoPartsStore",
            "name": name,
            "description": _truncate(description_raw, 500) or None,
            "url": canonical_url,
            "image": image_url,
            "telephone": org.phone or None,
            "address": {
                "@type": "PostalAddress",
                "streetAddress": org.address,
                "addressLocality": "Екатеринбург",
                "addressCountry": "RU",
            }
            if org.address
            else None,
            "parentOrganization": {
                "@type": "Organization",
                "name": "Свой Гараж",
                "url": site_origin.rstrip("/"),
            },
        },
        ensure_ascii=False,
    )

    return StaticPageSeoMeta(
        title=title,
        description=description,
        canonical_url=canonical_url,
        h1=name,
        json_ld=json_ld,
    )


def _build_organizations_seo(site_origin: str) -> StaticPageSeoMeta:
    canonical_url = _absolute_url(site_origin, "/organizations")
    title = "Организации — автозапчасти на «Свой Гараж»"
    description = (
        "Каталог организаций-партнёров «Свой Гараж»: контакты, адреса и информация "
        "о продавцах автозапчастей."
    )
    json_ld = json.dumps(
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "Организации — Свой Гараж",
            "description": description,
            "url": canonical_url,
            "isPartOf": {
                "@type": "WebSite",
                "name": "Свой Гараж",
                "url": site_origin.rstrip("/"),
            },
        },
        ensure_ascii=False,
    )
    return StaticPageSeoMeta(
        title=title,
        description=description,
        canonical_url=canonical_url,
        h1="Организации",
        json_ld=json_ld,
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


def _landing_prerender_supplements(
    db: Session,
    *,
    kind: str,
    slug: str,
    landing,
    total_count: int,
    top_items: list,
    site_origin: str,
) -> dict[str, str]:
    from app.services.landing_prerender_service import build_landing_prerender_supplements

    return build_landing_prerender_supplements(
        db,
        kind=kind,
        slug=slug,
        landing=landing,
        total_count=total_count,
        top_items=top_items,
        site_origin=site_origin,
    )


def _build_brand_landing_seo(db: Session, slug: str, *, site_origin: str) -> StaticPageSeoMeta | None:
    from app.services.new_parts_seo_card_service import (
        build_new_part_card_path,
        count_new_part_cards_by_brand,
        iter_new_part_cards_by_brand_for_prerender,
    )
    from app.services.seo_landing_page_service import resolve_brand_new_landing

    provisional = resolve_brand_new_landing(db, slug)
    if provisional is None:
        return None
    brand_name = provisional.brand_name or provisional.title_ru
    total = count_new_part_cards_by_brand(db, brand_name) if brand_name else 0
    landing = resolve_brand_new_landing(db, slug, card_count=total or None)
    if landing is None:
        return None

    cards = iter_new_part_cards_by_brand_for_prerender(db, brand_name) if brand_name else []
    links: list[tuple[str, str]] = []
    for card in cards:
        label = format_product_display_title(card.brand, card.article, card.name)
        path = build_new_part_card_path(card.id, card.brand, card.article)
        links.append((label, _absolute_url(site_origin, path)))

    supplements = _landing_prerender_supplements(
        db,
        kind="brand_new",
        slug=slug,
        landing=landing,
        total_count=total,
        top_items=cards[:12],
        site_origin=site_origin,
    )

    return StaticPageSeoMeta(
        title=landing.meta_title,
        description=_truncate(landing.meta_description, 160),
        canonical_url=_absolute_url(site_origin, landing.canonical_path),
        h1=f"Новые автозапчасти {brand_name}",
        keywords=build_page_keywords("brand_new", brand_name=brand_name),
        card_links=tuple(links),
        content_sections_html=supplements["content_sections_html"],
        faq_html=supplements["faq_html"],
        popular_queries_html=supplements["popular_queries_html"],
        crosslinks_html=supplements["crosslinks_html"],
        json_ld=supplements["json_ld"],
    )


def _build_category_landing_seo(db: Session, slug: str, *, site_origin: str) -> StaticPageSeoMeta | None:
    from app.services.new_parts_seo_card_service import (
        build_new_part_card_path,
        count_new_part_cards_by_category_slug,
        iter_new_part_cards_by_category_for_prerender,
    )
    from app.services.seo_landing_page_service import resolve_category_new_landing

    provisional = resolve_category_new_landing(db, slug)
    if provisional is None:
        return None
    title_ru = provisional.title_ru
    total = count_new_part_cards_by_category_slug(db, slug)
    landing = resolve_category_new_landing(db, slug, card_count=total or None)
    if landing is None:
        return None

    cards = iter_new_part_cards_by_category_for_prerender(db, slug)
    links: list[tuple[str, str]] = []
    for card in cards:
        label = format_product_display_title(card.brand, card.article, card.name)
        path = build_new_part_card_path(card.id, card.brand, card.article)
        links.append((label, _absolute_url(site_origin, path)))

    supplements = _landing_prerender_supplements(
        db,
        kind="category_new",
        slug=slug,
        landing=landing,
        total_count=total,
        top_items=cards[:12],
        site_origin=site_origin,
    )

    return StaticPageSeoMeta(
        title=landing.meta_title,
        description=_truncate(landing.meta_description, 160),
        canonical_url=_absolute_url(site_origin, landing.canonical_path),
        h1=f"Новые {title_ru} — каталог с доставкой",
        keywords=build_page_keywords(
            "category_new",
            title_ru=title_ru,
            search_query=landing.search_query,
        ),
        card_links=tuple(links),
        content_sections_html=supplements["content_sections_html"],
        faq_html=supplements["faq_html"],
        popular_queries_html=supplements["popular_queries_html"],
        crosslinks_html=supplements["crosslinks_html"],
        json_ld=supplements["json_ld"],
    )


def _build_used_brand_landing_seo(db: Session, slug: str, *, site_origin: str) -> StaticPageSeoMeta | None:
    from app.services.seo_landing_page_service import resolve_brand_used_landing
    from app.services.used_catalog_service import (
        count_used_products_by_brand,
        iter_used_products_by_brand_for_prerender,
    )

    provisional = resolve_brand_used_landing(db, slug)
    if provisional is None:
        return None
    brand_name = provisional.brand_name or provisional.title_ru
    total = count_used_products_by_brand(db, brand_name) if brand_name else 0
    landing = resolve_brand_used_landing(db, slug, product_count=total or None)
    if landing is None:
        return None

    products = iter_used_products_by_brand_for_prerender(db, brand_name) if brand_name else []
    links: list[tuple[str, str]] = []
    for product in products:
        label = format_product_display_title(product.brand, product.article, product.name)
        path = build_product_page_url(product, site_origin)
        links.append((label, path if path.startswith("http") else _absolute_url(site_origin, path)))

    supplements = _landing_prerender_supplements(
        db,
        kind="brand_used",
        slug=slug,
        landing=landing,
        total_count=total,
        top_items=products[:12],
        site_origin=site_origin,
    )

    return StaticPageSeoMeta(
        title=landing.meta_title,
        description=_truncate(landing.meta_description, 160),
        canonical_url=_absolute_url(site_origin, landing.canonical_path),
        h1=f"Б/у автозапчасти {brand_name}",
        keywords=build_page_keywords("brand_used", brand_name=brand_name),
        card_links=tuple(links),
        content_sections_html=supplements["content_sections_html"],
        faq_html=supplements["faq_html"],
        popular_queries_html=supplements["popular_queries_html"],
        crosslinks_html=supplements["crosslinks_html"],
        json_ld=supplements["json_ld"],
    )


def _build_used_category_landing_seo(db: Session, slug: str, *, site_origin: str) -> StaticPageSeoMeta | None:
    from app.services.seo_landing_page_service import resolve_category_used_landing
    from app.services.used_catalog_service import (
        count_used_products_by_part_type_id,
        iter_used_products_by_part_type_for_prerender,
    )

    provisional = resolve_category_used_landing(db, slug)
    if provisional is None:
        return None
    title_ru = provisional.title_ru
    total = count_used_products_by_part_type_id(db, provisional.part_type_id)
    landing = resolve_category_used_landing(db, slug, product_count=total or None)
    if landing is None:
        return None

    products = iter_used_products_by_part_type_for_prerender(db, provisional.part_type_id)
    links: list[tuple[str, str]] = []
    for product in products:
        label = format_product_display_title(product.brand, product.article, product.name)
        path = build_product_page_url(product, site_origin)
        links.append((label, path if path.startswith("http") else _absolute_url(site_origin, path)))

    supplements = _landing_prerender_supplements(
        db,
        kind="category_used",
        slug=slug,
        landing=landing,
        total_count=total,
        top_items=products[:12],
        site_origin=site_origin,
    )

    return StaticPageSeoMeta(
        title=landing.meta_title,
        description=_truncate(landing.meta_description, 160),
        canonical_url=_absolute_url(site_origin, landing.canonical_path),
        h1=f"Б/у {title_ru} — купить от продавцов",
        keywords=build_page_keywords(
            "category_used",
            title_ru=title_ru,
            search_query=landing.search_query,
        ),
        card_links=tuple(links),
        content_sections_html=supplements["content_sections_html"],
        faq_html=supplements["faq_html"],
        popular_queries_html=supplements["popular_queries_html"],
        crosslinks_html=supplements["crosslinks_html"],
        json_ld=supplements["json_ld"],
    )


def _build_used_geo_landing_seo(db: Session, slug: str, *, site_origin: str) -> StaticPageSeoMeta | None:
    from app.services.seo_landing_page_service import resolve_geo_landing
    from app.services.used_catalog_service import (
        count_used_products_by_city,
        iter_used_products_by_city_for_prerender,
    )
    from app.utils.organization_city import format_city_in_prepositional

    provisional = resolve_geo_landing(db, slug)
    if provisional is None:
        return None
    city = provisional.city or provisional.title_ru
    total = count_used_products_by_city(db, city) if city else 0
    landing = resolve_geo_landing(db, slug, product_count=total or None)
    if landing is None:
        return None

    products = iter_used_products_by_city_for_prerender(db, city) if city else []
    links: list[tuple[str, str]] = []
    for product in products:
        label = format_product_display_title(product.brand, product.article, product.name)
        path = build_product_page_url(product, site_origin)
        links.append((label, path if path.startswith("http") else _absolute_url(site_origin, path)))

    city_prep = format_city_in_prepositional(city)
    supplements = _landing_prerender_supplements(
        db,
        kind="geo",
        slug=slug,
        landing=landing,
        total_count=total,
        top_items=products[:12],
        site_origin=site_origin,
    )

    return StaticPageSeoMeta(
        title=landing.meta_title,
        description=_truncate(landing.meta_description, 160),
        canonical_url=_absolute_url(site_origin, landing.canonical_path),
        h1=f"Б/у автозапчасти в {city_prep}",
        keywords=build_page_keywords("geo_used", city=city),
        card_links=tuple(links),
        content_sections_html=supplements["content_sections_html"],
        faq_html=supplements["faq_html"],
        popular_queries_html=supplements["popular_queries_html"],
        crosslinks_html=supplements["crosslinks_html"],
        json_ld=supplements["json_ld"],
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
    brand_filters = query_params.get("brand") or []

    if path == "/":
        return _build_home_seo(origin)
    if path == "/catalog":
        return _build_catalog_seo(origin)
    if path == "/autoparts":
        return _build_autoparts_redirect_seo(origin)
    if path == "/autoparts/new":
        return _build_new_parts_seo(origin, search_q, brands=brand_filters)
    if path == "/autoparts/used":
        return _build_used_parts_seo(
            origin,
            search_q,
            brands=brand_filters,
            db=db if _used_parts_query_is_q_only(query_params) else None,
        )
    if path == "/about":
        return _build_about_seo(origin)
    if path == "/delivery":
        return _build_delivery_seo(origin)
    if path == "/organizations":
        return _build_organizations_seo(origin)
    if path == "/payment":
        return _build_payment_seo(origin)
    if path == "/reviews":
        return _build_reviews_seo(origin)
    if path == "/cookie-policy":
        return _build_cookie_policy_seo(origin)
    if path == "/privacy":
        return _build_privacy_seo(origin)
    if path == "/offer":
        return _build_offer_seo(origin)
    if path == "/personal-data-consent":
        return _build_personal_data_consent_seo(origin)

    org_match = ORGANIZATION_DETAIL_RE.match(path)
    if org_match and db is not None:
        return _build_organization_detail_seo(db, org_match.group("org_id"), site_origin=origin)

    brand_match = NEW_BRAND_LANDING_RE.match(path)
    if brand_match and db is not None:
        return _build_brand_landing_seo(db, brand_match.group("slug"), site_origin=origin)

    category_match = NEW_CATEGORY_LANDING_RE.match(path)
    if category_match and db is not None:
        return _build_category_landing_seo(db, category_match.group("slug"), site_origin=origin)

    used_brand_match = USED_BRAND_LANDING_RE.match(path)
    if used_brand_match and db is not None:
        return _build_used_brand_landing_seo(db, used_brand_match.group("slug"), site_origin=origin)

    used_category_match = USED_CATEGORY_LANDING_RE.match(path)
    if used_category_match and db is not None:
        return _build_used_category_landing_seo(db, used_category_match.group("slug"), site_origin=origin)

    used_geo_match = USED_GEO_LANDING_RE.match(path)
    if used_geo_match and db is not None:
        return _build_used_geo_landing_seo(db, used_geo_match.group("slug"), site_origin=origin)

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
    links_html = ""
    if meta.card_links:
        items = "".join(
            f'<li><a href="{html.escape(url, quote=True)}">{html.escape(label)}</a></li>'
            for label, url in meta.card_links
        )
        links_html = f"<section><h2>Каталог</h2><ul>{items}</ul></section>"
    parsed = urlsplit(meta.canonical_url or "")
    page_origin = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else None
    og_image = html.escape(resolve_default_og_image_url(page_origin), quote=True)
    keywords_tag = ""
    if meta.keywords:
        keywords_tag = (
            f'  <meta name="keywords" content="{html.escape(meta.keywords, quote=True)}" />\n'
        )
    json_ld_script = ""
    if meta.json_ld:
        json_ld_script = f'  <script type="application/ld+json">{meta.json_ld}</script>\n'

    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="{robots}" />
  <title>{title}</title>
  <meta name="description" content="{description}" />
{keywords_tag}
  <link rel="canonical" href="{canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Свой Гараж" />
  <meta property="og:title" content="{title}" />
  <meta property="og:description" content="{description}" />
  <meta property="og:url" content="{canonical}" />
  <meta property="og:locale" content="ru_RU" />
  <meta property="og:image" content="{og_image}" />
{json_ld_script}</head>
<body>
  <main>
    <h1>{h1}</h1>
    <p>{body_desc}</p>
    {meta.content_sections_html}
    {meta.faq_html}
    {meta.popular_queries_html}
    {meta.crosslinks_html}
    {links_html}
    <p><a href="{canonical}">Открыть на «Свой Гараж»</a></p>
  </main>
</body>
</html>
"""
