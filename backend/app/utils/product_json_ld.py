from __future__ import annotations

import json
import re
from typing import Any

from app.utils.organization_city import DEFAULT_CITY
from app.utils.product_display_name import extract_product_description, format_product_display_title
from app.utils.product_search_seo import (
    build_product_alternate_names,
    build_product_offer_json_ld,
)
from app.utils.seo_constants import resolve_product_placeholder_image_url

SCHEMA_ORG = "https://schema.org"
IN_STOCK = f"{SCHEMA_ORG}/InStock"
OUT_OF_STOCK = f"{SCHEMA_ORG}/OutOfStock"
NEW_CONDITION = f"{SCHEMA_ORG}/NewCondition"
USED_CONDITION = f"{SCHEMA_ORG}/UsedCondition"


def format_price_ld(price: float | int | str | None) -> str | None:
    if price is None:
        return None
    try:
        amount = float(price)
    except (TypeError, ValueError):
        return None
    if amount <= 0:
        return None
    return f"{amount:.2f}"


def _strip_html(value: str | None) -> str:
    text = re.sub(r"<[^>]+>", " ", str(value or ""))
    return re.sub(r"\s+", " ", text).strip()


def _truncate_body(text: str, max_len: int) -> str:
    value = re.sub(r"\s+", " ", (text or "")).strip()
    if not value:
        return ""
    if len(value) <= max_len:
        return value
    return f"{value[: max_len - 1].strip()}…"


def _fitment_hint(fitment_text: str | None, max_len: int = 80) -> str:
    fitment = re.sub(r"\s+", " ", (fitment_text or "")).strip().rstrip(".")
    if not fitment:
        return ""
    if len(fitment) <= max_len:
        return fitment
    return f"{fitment[: max_len - 1].strip()}…"


def product_body_description(
    *,
    brand: str | None,
    article: str | None,
    name: str | None,
    unique_description: str | None,
    short_name: str | None = None,
    part_type_name: str | None = None,
    city: str | None = None,
    fitment_text: str | None = None,
    seller_name: str | None = None,
    is_new: bool = False,
    max_len: int = 500,
) -> str:
    unique = _strip_html(unique_description)
    short = (short_name or "").strip()
    display = (name or "").strip()
    brand_text = (brand or "").strip()
    article_text = (article or "").strip()
    part_type = (part_type_name or "").strip()
    city_text = (city or DEFAULT_CITY).strip() or DEFAULT_CITY
    seller = (seller_name or "").strip()
    condition = "Новая" if is_new else "Б/у"
    label = f"{brand_text} {article_text}".strip() or display or "автозапчасть"
    fitment = _fitment_hint(fitment_text)

    sentences: list[str] = []

    if unique and len(unique) >= 20:
        sentences.append(unique if unique.endswith(".") else f"{unique}.")

    if part_type:
        sentences.append(
            f"{condition} {part_type.lower()} {label} — предложение на маркетплейсе «Свой Гараж»."
        )
    else:
        sentences.append(
            f"{condition} автозапчасть {label} — предложение на маркетплейсе «Свой Гараж»."
        )

    if short and short.casefold() not in " ".join(sentences).casefold():
        sentences.append(f"Назначение: {short}.")

    if fitment:
        sentences.append(f"По справочнику подходит для: {fitment}.")

    if seller:
        sentences.append(f"Продавец: {seller}, город {city_text}.")
    else:
        sentences.append(f"Товар находится в {city_text}.")

    if is_new:
        sentences.append(
            "Новая деталь в упаковке или на складе. Доставка по России, самовывоз — у продавца."
        )
    else:
        sentences.append(
            "Перед покупкой можно осмотреть деталь и уточнить совместимость у продавца. "
            "Доставка по России, самовывоз — у продавца."
        )

    if not unique:
        for candidate in (short, display):
            if candidate and len(candidate) >= 20 and candidate.casefold() not in " ".join(sentences).casefold():
                sentences.insert(0, candidate if candidate.endswith(".") else f"{candidate}.")
                break

    combined = " ".join(sentence for sentence in sentences if sentence)
    return _truncate_body(combined, max_len)


def sanitize_json_ld(value: Any) -> Any:
    if isinstance(value, dict):
        cleaned: dict[str, Any] = {}
        for key, item in value.items():
            if item is None:
                continue
            sanitized = sanitize_json_ld(item)
            if sanitized is None:
                continue
            if isinstance(sanitized, str) and not sanitized.strip():
                continue
            if isinstance(sanitized, (list, dict)) and not sanitized:
                continue
            cleaned[key] = sanitized
        return cleaned
    if isinstance(value, list):
        items = [sanitize_json_ld(item) for item in value]
        return [item for item in items if item is not None and item != "" and item != {} and item != []]
    return value


def dumps_json_ld(obj: dict[str, Any] | None) -> str:
    if not obj:
        return ""
    return json.dumps(sanitize_json_ld(obj), ensure_ascii=False)


def build_offer_json_ld(
    *,
    canonical_url: str,
    price: str,
    in_stock: bool,
    is_new: bool,
    seller_name: str | None = None,
    seller_phone: str | None = None,
    seller_address: str | None = None,
    city: str | None = None,
) -> dict[str, Any]:
    city_name = (city or DEFAULT_CITY).strip() or DEFAULT_CITY
    offer: dict[str, Any] = {
        "@type": "Offer",
        "url": canonical_url,
        "priceCurrency": "RUB",
        "price": price,
        "availability": IN_STOCK if in_stock else OUT_OF_STOCK,
        "itemCondition": NEW_CONDITION if is_new else USED_CONDITION,
    }

    if seller_name or seller_phone or seller_address:
        seller: dict[str, Any] = {
            "@type": "Organization",
            "name": (seller_name or "Свой Гараж").strip() or "Свой Гараж",
        }
        phone_str = (seller_phone or "").strip()
        if phone_str:
            seller["telephone"] = phone_str
        address_str = (seller_address or "").strip()
        if address_str or city_name:
            seller["address"] = {
                "@type": "PostalAddress",
                "addressLocality": city_name,
                "addressCountry": "RU",
            }
            if address_str:
                seller["address"]["streetAddress"] = address_str
        offer["seller"] = seller

    return offer


def _catalog_product_image_urls(product, site_origin: str, *, max_count: int = 5) -> list[str]:
    from app.services.yandex_feed_xml_service import _absolute_photo_url

    urls: list[str] = []
    seen: set[str] = set()
    for photo in product.photos or []:
        raw_url = getattr(photo, "photo_url", None)
        if not raw_url:
            continue
        path = raw_url
        if not str(raw_url).startswith(("http://", "https://")):
            path = photo.full_url if hasattr(photo, "full_url") else raw_url
        image_url = _absolute_photo_url(path, site_origin)
        if not image_url or image_url in seen:
            continue
        seen.add(image_url)
        urls.append(image_url)
        if len(urls) >= max_count:
            break
    if not urls:
        # Карточка без фото — лого сайта на белом фоне, чтобы разметка Product была валидной.
        urls.append(resolve_product_placeholder_image_url(site_origin))
    return urls


def _catalog_product_image_url(product, site_origin: str) -> str | None:
    urls = _catalog_product_image_urls(product, site_origin, max_count=1)
    return urls[0] if urls else None


def is_catalog_product_json_ld_eligible(product) -> bool:
    if (product.quantity or 0) <= 0:
        return False
    brand = (product.brand or "").strip()
    if not brand:
        return False
    if not (product.article or "").strip():
        return False
    if not (product.name or "").strip():
        return False
    if not format_price_ld(product.price):
        return False
    # Фото не обязательно: для карточек без фото используется лого-фолбэк.
    return True


def build_catalog_product_json_ld(
    product,
    *,
    site_origin: str,
    canonical_url: str,
    city: str | None = None,
) -> dict[str, Any] | None:
    if not is_catalog_product_json_ld_eligible(product):
        return None

    brand = (product.brand or "").strip()
    article = (product.article or "").strip()
    name = format_product_display_title(brand, article, product.name)
    short_name = extract_product_description(product.name, brand, article)
    unique_desc = _strip_html(product.description)
    image_urls = _catalog_product_image_urls(product, site_origin)
    if not image_urls:
        return None

    price = format_price_ld(product.price)
    if not price:
        return None

    in_stock = (product.quantity or 0) > 0
    organization = getattr(product, "organization", None)
    org_name = getattr(organization, "name", None) if organization else None
    org_phone = getattr(organization, "phone", None) if organization else None
    org_address = getattr(organization, "address", None) if organization else None
    part_type = getattr(product, "part_type", None)
    category_name = ""
    if part_type is not None:
        raw_category = getattr(part_type, "name", None)
        if isinstance(raw_category, str):
            category_name = raw_category.strip()

    description = product_body_description(
        brand=brand,
        article=article,
        name=name,
        unique_description=unique_desc,
        short_name=short_name,
        part_type_name=category_name or None,
        city=city,
        is_new=bool(product.is_new),
    )

    product_json: dict[str, Any] = {
        "@context": SCHEMA_ORG,
        "@type": "Product",
        "@id": f"{canonical_url}#product",
        "url": canonical_url,
        "name": name,
        "description": description,
        "sku": article,
        "mpn": article,
        "alternateName": build_product_alternate_names(brand=brand, article=article) or None,
        "brand": {"@type": "Brand", "name": brand},
        "manufacturer": {"@type": "Organization", "name": brand},
        "category": category_name or None,
        "image": image_urls,
        "offers": build_product_offer_json_ld(
            canonical_url=canonical_url,
            price=price,
            in_stock=in_stock,
            is_new=bool(product.is_new),
            seller_name=str(org_name) if org_name is not None else None,
            seller_phone=str(org_phone) if org_phone is not None else None,
            seller_address=str(org_address) if org_address is not None else None,
            city=city,
        ),
    }
    return sanitize_json_ld(product_json)


def is_new_part_json_ld_eligible(card) -> bool:
    brand = str(getattr(card, "brand", "") or "").strip()
    article = str(getattr(card, "article", "") or "").strip()
    if not brand or not article:
        return False
    if not format_price_ld(getattr(card, "price", None)):
        return False
    name = str(getattr(card, "name", "") or "").strip()
    if not name and not f"{brand} {article}".strip():
        return False
    # Фото не обязательно: для карточек без фото используется лого-фолбэк.
    return True


def build_new_part_card_json_ld(
    card,
    *,
    site_origin: str,
    canonical_url: str,
    display_price: float | int | str | None = None,
) -> dict[str, Any] | None:
    if not is_new_part_json_ld_eligible(card):
        return None

    from app.services.yandex_feed_xml_service import _absolute_photo_url

    brand = str(card.brand or "").strip()
    article = str(card.article or "").strip()
    display_name = str(card.name or "").strip() or f"{brand} {article}".strip()
    unique_desc = str(card.description or "").strip()
    description = product_body_description(
        brand=brand,
        article=article,
        name=display_name,
        unique_description=unique_desc,
        is_new=True,
    )

    image_url = _absolute_photo_url(str(card.image_url or "").strip(), site_origin)
    if not image_url:
        image_url = resolve_product_placeholder_image_url(site_origin)

    price_source = display_price if display_price is not None else card.price
    price = format_price_ld(price_source)
    if not price:
        return None

    in_stock = int(card.stock_count or 0) > 0
    alternate_names = build_product_alternate_names(brand=brand, article=article)
    offers = build_product_offer_json_ld(
        canonical_url=canonical_url,
        price=price,
        in_stock=in_stock,
        is_new=True,
        seller_name=None,
        seller_phone=None,
        seller_address=None,
        city=DEFAULT_CITY,
    )
    if offers is None:
        offers = build_offer_json_ld(
            canonical_url=canonical_url,
            price=price,
            in_stock=in_stock,
            is_new=True,
        )
        offers["areaServed"] = {"@type": "Country", "name": "RU"}
        offers["shippingDetails"] = {
            "@type": "OfferShippingDetails",
            "shippingDestination": {
                "@type": "DefinedRegion",
                "addressCountry": "RU",
            },
        }
        offers["availableAtOrFrom"] = {
            "@type": "Place",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": DEFAULT_CITY,
                "addressCountry": "RU",
            },
        }
    product_json: dict[str, Any] = {
        "@context": SCHEMA_ORG,
        "@type": "Product",
        "@id": f"{canonical_url}#product",
        "url": canonical_url,
        "name": display_name,
        "description": description,
        "sku": article,
        "mpn": article,
        "alternateName": alternate_names or None,
        "brand": {"@type": "Brand", "name": brand},
        "manufacturer": {"@type": "Organization", "name": brand},
        "image": [image_url],
        "offers": offers,
    }
    return sanitize_json_ld(product_json)


def build_json_ld_script_tags(*json_ld_strings: str) -> str:
    tags: list[str] = []
    for raw in json_ld_strings:
        if not raw or not str(raw).strip():
            continue
        tags.append(f'<script type="application/ld+json">{str(raw).strip()}</script>')
    return "\n  ".join(tags)


def split_graph_json_ld_for_yandex(*, product_json_ld: str, json_ld_graph: str) -> list[str]:
    """
    Отдельные JSON-LD блоки для Яндекса (не @graph).
    Первым идёт standalone Product с @context — иначе «Товары» не видят name/price/brand.
    """
    blocks: list[str] = []
    has_product = bool(product_json_ld and str(product_json_ld).strip())

    if has_product:
        blocks.append(str(product_json_ld).strip())

    if not json_ld_graph:
        return blocks

    try:
        parsed = json.loads(json_ld_graph)
    except json.JSONDecodeError:
        return blocks

    nodes: list[dict[str, Any]] = []
    if isinstance(parsed, dict) and isinstance(parsed.get("@graph"), list):
        nodes = [node for node in parsed["@graph"] if isinstance(node, dict)]
    elif isinstance(parsed, dict) and parsed.get("@type"):
        nodes = [parsed]

    for node in nodes:
        node_type = node.get("@type")
        if node_type == "Product":
            if not has_product:
                node_copy = dict(node)
                node_copy.pop("@context", None)
                dumped = dumps_json_ld({"@context": SCHEMA_ORG, **node_copy})
                if dumped:
                    blocks.append(dumped)
            continue
        if node_type == "WebPage":
            continue
        node_copy = dict(node)
        node_copy.pop("@context", None)
        dumped = dumps_json_ld({"@context": SCHEMA_ORG, **node_copy})
        if dumped:
            blocks.append(dumped)

    return blocks


def build_product_og_meta_tags(*, price: str | None, in_stock: bool) -> str:
    import html as html_module

    tags: list[str] = []
    if price:
        tags.append(
            f'<meta property="product:price:amount" content="{html_module.escape(str(price), quote=True)}" />'
        )
        tags.append('<meta property="product:price:currency" content="RUB" />')
    availability = "in stock" if in_stock else "out of stock"
    tags.append(
        f'<meta property="product:availability" content="{html_module.escape(availability, quote=True)}" />'
    )
    return "\n  ".join(tags)


def build_product_article_microdata_prefix(
    *,
    name: str,
    description: str,
    brand: str,
    article: str,
    image_url: str | None,
    price: str | None,
    in_stock: bool,
    canonical_url: str,
) -> str:
    import html as html_module

    esc = html_module.escape
    availability_href = IN_STOCK if in_stock else OUT_OF_STOCK
    image_link = (
        f'    <link itemprop="image" href="{esc(image_url, quote=True)}" />\n'
        if image_url
        else ""
    )
    price_meta = (
        f'    <meta itemprop="price" content="{esc(str(price), quote=True)}" />\n'
        if price
        else ""
    )
    return (
        f'  <article itemscope itemtype="{SCHEMA_ORG}/Product">\n'
        f'    <meta itemprop="name" content="{esc(name, quote=True)}" />\n'
        f'    <meta itemprop="description" content="{esc(description, quote=True)}" />\n'
        f'    <link itemprop="url" href="{esc(canonical_url, quote=True)}" />\n'
        f'    <meta itemprop="sku" content="{esc(article, quote=True)}" />\n'
        f"{image_link}"
        f'    <div itemprop="brand" itemscope itemtype="{SCHEMA_ORG}/Brand">\n'
        f'      <meta itemprop="name" content="{esc(brand, quote=True)}" />\n'
        f"    </div>\n"
        f'    <div itemprop="offers" itemscope itemtype="{SCHEMA_ORG}/Offer">\n'
        f'      <link itemprop="url" href="{esc(canonical_url, quote=True)}" />\n'
        f"{price_meta}"
        f'      <meta itemprop="priceCurrency" content="RUB" />\n'
        f'      <link itemprop="availability" href="{availability_href}" />\n'
        f"    </div>\n"
    )
