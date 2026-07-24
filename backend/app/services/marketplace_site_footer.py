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


def build_marketplace_site_footer(
    *,
    product_url: str,
    internal_code: str | None = None,
) -> str:
    url = (product_url or "").strip()
    code = " ".join(str(internal_code or "").strip().split())
    lines = [
        "Эту запчасть вы также можете посмотреть на сайте Свой Гараж:",
        url,
        "",
    ]
    if code:
        lines.extend(
            [
                f"Внутренний код товара на сайте Свой Гараж: {code}",
                "",
            ]
        )
    lines.extend(
        [
            "На площадке Свой Гараж доступны фотографии, характеристики и актуальная цена. "
            "Перейдите по ссылке выше, чтобы открыть карточку этого товара на нашем сайте "
            "и связаться с продавцом напрямую.",
            "",
            "Если вы нашли это объявление на Авито или Дром, карточку с полным описанием "
            "и дополнительными сведениями удобнее смотреть на Свой Гараж по ссылке выше.",
        ]
    )
    return "\n".join(lines)


def _product_like(product) -> SimpleNamespace | object:
    if product is None:
        return SimpleNamespace(id=None, brand=None, article=None, internal_code=None)
    if hasattr(product, "id") and not isinstance(product, dict):
        return product
    if isinstance(product, dict):
        return SimpleNamespace(
            id=product.get("id") or product.get("product_id"),
            brand=product.get("brand"),
            article=product.get("article"),
            internal_code=product.get("internal_code"),
        )
    return product


def _internal_code_of(product) -> str | None:
    obj = _product_like(product)
    code = getattr(obj, "internal_code", None)
    if code is None and isinstance(product, dict):
        code = product.get("internal_code")
    text = " ".join(str(code or "").strip().split())
    return text or None


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
    product_obj = _product_like(product)
    url = build_product_page_url(product_obj, origin)
    footer = build_marketplace_site_footer(
        product_url=url,
        internal_code=_internal_code_of(product),
    )
    if not base:
        return footer
    return f"{base}\n\n{footer}"
