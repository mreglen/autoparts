from __future__ import annotations

import re


def normalize_partnumber(pn: str | None) -> str:
    """Убирает спецсимволы и приводит к верхнему регистру (IF-1009 -> IF1009)."""
    if not pn:
        return ""
    return re.sub(r"[^A-Za-z0-9А-Яа-яЁё]", "", str(pn)).upper()


def build_product_lookup_key(brand: str | None, article: str | None) -> str:
    brand_text = (brand or "").strip().casefold()
    article_norm = normalize_partnumber(article)
    if not brand_text or not article_norm:
        return ""
    return f"{brand_text}|{article_norm}"
