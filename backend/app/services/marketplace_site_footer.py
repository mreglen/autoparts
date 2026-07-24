"""Append site link footer to marketplace (Avito/Drom) product descriptions."""
from __future__ import annotations

from types import SimpleNamespace
from urllib.parse import urlparse

from app.core.config import settings
from app.utils.product_urls import build_product_page_url

FOOTER_MARKER = "эту запчасть вы также можете посмотреть на сайте свой гараж"


def resolve_public_site_origin(preferred: str | None = None) -> str:
    if preferred:
        host = preferred.strip().rstrip("/")
        if host:
            parsed = urlparse(host)
            if parsed.scheme and parsed.netloc:
                return f"{parsed.scheme}://{parsed.netloc}"
            if "://" not in host:
                return f"https://{host}"
            return host
    base = (settings.PUBLIC_BASE_URL or settings.BASE_URL or "").strip().rstrip("/")
    if not base:
        return "https://svoygarage.ru"
    parsed = urlparse(base)
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}"
    return "https://svoygarage.ru"


def build_marketplace_site_footer(*, product_url: str) -> str:
    url = (product_url or "").strip()
    return (
        "Эту запчасть вы также можете посмотреть на сайте Свой Гараж:\n"
        f"{url}\n\n"
        "На площадке Свой Гараж доступны фотографии, характеристики и актуальная цена. "
        "Перейдите по ссылке выше, чтобы открыть карточку этого товара на нашем сайте "
        "и связаться с продавцом напрямую.\n\n"
        "Если вы нашли это объявление на Авито или Дром, карточку с полным описанием "
        "и дополнительными сведениями удобнее смотреть на Свой Гараж по ссылке выше."
    )


def _product_like(product) -> SimpleNamespace | object:
    if product is None:
        return SimpleNamespace(id=None, brand=None, article=None)
    if hasattr(product, "id"):
        return product
    if isinstance(product, dict):
        return SimpleNamespace(
            id=product.get("id") or product.get("product_id"),
            brand=product.get("brand"),
            article=product.get("article"),
        )
    return product


def append_marketplace_site_info(
    description: str | None,
    *,
    enabled: bool,
    product,
    site_origin: str | None = None,
) -> str:
    """Return description with site footer when org setting is enabled."""
    base = (description or "").rstrip()
    if not enabled:
        return base

    if FOOTER_MARKER in base.casefold():
        return base

    origin = resolve_public_site_origin(site_origin)
    url = build_product_page_url(_product_like(product), origin)
    footer = build_marketplace_site_footer(product_url=url)
    if not base:
        return footer
    return f"{base}\n\n{footer}"
