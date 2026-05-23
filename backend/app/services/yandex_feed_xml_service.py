from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Iterable
from urllib.parse import urlparse
from xml.sax.saxutils import escape

from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models.part_type import PartType
from app.models.product import Product, ProductPhoto


@dataclass
class YandexUsedFeedResult:
    xml: str
    checksum: str
    offers_count: int
    categories_count: int
    new_offers_count: int
    used_offers_count: int


def _resolve_site_origin(preferred_host_url: str | None = None) -> str:
    if preferred_host_url:
        host = preferred_host_url.strip().rstrip("/")
        if host:
            return host
    base = (settings.PUBLIC_BASE_URL or "").strip().rstrip("/")
    if not base:
        return "https://svoygarage.ru"
    parsed = urlparse(base)
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}"
    return "https://svoygarage.ru"


def _format_price(value: Decimal | float | int | None) -> str:
    if value is None:
        return "0"
    if isinstance(value, Decimal):
        return f"{value:.2f}"
    try:
        return f"{float(value):.2f}"
    except Exception:
        return "0"


def _absolute_photo_url(photo_url: str | None, site_origin: str) -> str | None:
    if not photo_url:
        return None
    url = str(photo_url).strip()
    if not url:
        return None
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if url.startswith("/uploads/"):
        return f"{site_origin}{url}"
    if url.startswith("/pictures/") or url.startswith("/videos/"):
        return f"{site_origin}/uploads{url}"
    if url.startswith("/"):
        return f"{site_origin}{url}"
    return f"{site_origin}/{url}"


def _iter_catalog_products(db: Session) -> Iterable[Product]:
    return (
        db.query(Product)
        .options(
            selectinload(Product.photos),
            selectinload(Product.part_type),
            selectinload(Product.compatible_vehicles),
        )
        .filter(Product.quantity > 0)
        .order_by(Product.id.desc())
        .all()
    )


def _vehicle_params(product: Product) -> list[tuple[str, str]]:
    params: list[tuple[str, str]] = []
    vehicles = product.compatible_vehicles or []
    if not vehicles:
        return params
    brands = sorted({(v.brand or "").strip() for v in vehicles if (v.brand or "").strip()})
    models = sorted({(v.model or "").strip() for v in vehicles if (v.model or "").strip()})
    if brands:
        params.append(("Марка авто", ", ".join(brands[:5])))
    if models:
        params.append(("Модель авто", ", ".join(models[:5])))
    generations = sorted(
        {(v.generation or "").strip() for v in vehicles if (v.generation or "").strip()}
    )
    if generations:
        params.append(("Поколение", ", ".join(generations[:5])))
    return params


def _offer_lines(
    product: Product,
    *,
    site_origin: str,
    used_condition_reason: str,
) -> list[str] | None:
    category_id = int(product.part_type_id or 1)
    title = (product.name or "").strip() or f"{(product.brand or '').strip()} {(product.article or '').strip()}".strip()
    title = title or f"Запчасть #{product.id}"
    product_url = f"{site_origin}/part/{product.id}"
    price_value = _format_price(product.price)
    available = "true" if (product.quantity or 0) > 0 else "false"
    is_new_item = bool(product.is_new)

    photos = product.photos or []
    primary_photo = None
    for ph in photos:
        primary_photo = _absolute_photo_url(getattr(ph, "photo_url", None), site_origin)
        if primary_photo:
            break
    if not primary_photo:
        return None

    type_prefix = (product.part_type.name if product.part_type else "Автозапчасти") or "Автозапчасти"
    vendor = (product.brand or "Unknown")[:255]
    model = title[:255]
    if is_new_item:
        desc = (product.description or "").strip() or f"Новая автозапчасть {title}"
        condition_label = "Новая"
    else:
        desc = (product.description or "").strip() or f"Б/у автозапчасть {title}"
        condition_label = "Б/у"

    lines = [
        f'      <offer id="{product.id}" available="{available}" type="vendor.model">',
        f"        <typePrefix>{escape(type_prefix)}</typePrefix>",
        f"        <vendor>{escape(vendor)}</vendor>",
        f"        <model>{escape(model)}</model>",
        f"        <url>{escape(product_url)}</url>",
        f"        <price>{price_value}</price>",
        "        <currencyId>RUR</currencyId>",
        f"        <categoryId>{category_id}</categoryId>",
        f"        <picture>{escape(primary_photo)}</picture>",
        f"        <description><![CDATA[{desc}]]></description>",
        f'        <param name="Состояние">{escape(condition_label)}</param>',
    ]

    if product.article:
        lines.append(f'        <param name="Артикул">{escape(str(product.article)[:255])}</param>')

    for param_name, param_value in _vehicle_params(product):
        lines.append(f'        <param name="{escape(param_name)}">{escape(param_value)}</param>')

    if not is_new_item:
        reason = (used_condition_reason or "Товар бывший в употреблении, проверен продавцом").strip()
        lines.extend(
            [
                '        <condition type="preowned">',
                "          <reason>",
                f"            {escape(reason)}",
                "          </reason>",
                "        </condition>",
            ]
        )

    lines.append("      </offer>")
    return lines


def generate_used_yml_feed(
    db: Session,
    *,
    preferred_host_url: str | None,
    condition_type: str = "preowned",
    condition_reason: str = "Товар бывший в употреблении, проверен продавцом",
) -> YandexUsedFeedResult:
    del condition_type  # состояние определяется per-offer по product.is_new

    site_origin = _resolve_site_origin(preferred_host_url)
    products = list(_iter_catalog_products(db))

    categories_map: dict[int, str] = {}
    for p in products:
        pt = p.part_type
        if pt and pt.id not in categories_map:
            categories_map[pt.id] = pt.name or f"Категория {pt.id}"
    if not categories_map:
        categories_map[1] = "Автозапчасти"

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<yml_catalog date="{escape(now)}">',
        "  <shop>",
        "    <name>Свой Гараж</name>",
        f"    <company>{escape('ООО «Кроан»')}</company>",
        f"    <url>{escape(site_origin)}</url>",
        "    <currencies>",
        '      <currency id="RUR" rate="1"/>',
        "    </currencies>",
        "    <categories>",
    ]

    for category_id, category_name in sorted(categories_map.items(), key=lambda x: x[0]):
        lines.append(
            f'      <category id="{int(category_id)}">{escape(category_name)}</category>'
        )
    lines.extend(["    </categories>", "    <offers>"])

    offers_count = 0
    new_offers_count = 0
    used_offers_count = 0
    for p in products:
        offer_lines = _offer_lines(
            p,
            site_origin=site_origin,
            used_condition_reason=condition_reason,
        )
        if not offer_lines:
            continue
        offers_count += 1
        if p.is_new:
            new_offers_count += 1
        else:
            used_offers_count += 1
        lines.extend(offer_lines)

    lines.extend(["    </offers>", "  </shop>", "</yml_catalog>"])
    xml_payload = "\n".join(lines)
    checksum = hashlib.sha256(xml_payload.encode("utf-8")).hexdigest()
    return YandexUsedFeedResult(
        xml=xml_payload,
        checksum=checksum,
        offers_count=offers_count,
        categories_count=len(categories_map),
        new_offers_count=new_offers_count,
        used_offers_count=used_offers_count,
    )
