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


def _iter_used_products(db: Session) -> Iterable[Product]:
    return (
        db.query(Product)
        .options(
            selectinload(Product.photos),
            selectinload(Product.part_type),
        )
        .filter(Product.is_new == False)  # noqa: E712
        .filter(Product.quantity > 0)
        .order_by(Product.id.desc())
        .all()
    )


def generate_used_yml_feed(
    db: Session,
    *,
    preferred_host_url: str | None,
    condition_type: str = "preowned",
    condition_reason: str = "Товар бывший в употреблении, проверен продавцом",
) -> YandexUsedFeedResult:
    site_origin = _resolve_site_origin(preferred_host_url)
    products = list(_iter_used_products(db))

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
    lines.extend(
        [
            "    </categories>",
            "    <offers>",
        ]
    )

    offers_count = 0
    for p in products:
        category_id = int(p.part_type_id or 1)
        title = (p.name or "").strip() or f"{(p.brand or '').strip()} {(p.article or '').strip()}".strip()
        title = title or f"Запчасть #{p.id}"
        product_url = f"{site_origin}/part/{p.id}"
        price_value = _format_price(p.price)
        desc = (p.description or "").strip() or f"Б/У автозапчасть {title}"
        available = "true" if (p.quantity or 0) > 0 else "false"

        photos = p.photos or []
        primary_photo = None
        for ph in photos:
            primary_photo = _absolute_photo_url(getattr(ph, "photo_url", None), site_origin)
            if primary_photo:
                break
        if not primary_photo:
            continue

        offers_count += 1
        lines.extend(
            [
                f'      <offer id="{p.id}" available="{available}" type="vendor.model">',
                f"        <typePrefix>{escape((p.part_type.name if p.part_type else 'Автозапчасти') or 'Автозапчасти')}</typePrefix>",
                f"        <vendor>{escape((p.brand or 'Unknown')[:255])}</vendor>",
                f"        <model>{escape(title[:255])}</model>",
                f"        <url>{escape(product_url)}</url>",
                f"        <price>{price_value}</price>",
                "        <currencyId>RUR</currencyId>",
                f"        <categoryId>{category_id}</categoryId>",
                f"        <picture>{escape(primary_photo)}</picture>",
                f"        <description><![CDATA[{desc}]]></description>",
                f'        <condition type="{escape(condition_type or "preowned")}">',
                "          <reason>",
                f"            {escape(condition_reason or 'Товар бывший в употреблении')}",
                "          </reason>",
                "        </condition>",
                "      </offer>",
            ]
        )

    lines.extend(["    </offers>", "  </shop>", "</yml_catalog>"])
    xml_payload = "\n".join(lines)
    checksum = hashlib.sha256(xml_payload.encode("utf-8")).hexdigest()
    return YandexUsedFeedResult(
        xml=xml_payload,
        checksum=checksum,
        offers_count=offers_count,
        categories_count=len(categories_map),
    )
