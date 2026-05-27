from __future__ import annotations

import re


def _escape_regex(value: str) -> str:
    return re.escape(str(value or ""))


def _normalize_article(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"[^A-Za-z0-9А-Яа-яЁё]", "", str(value), flags=re.IGNORECASE).upper()


def _strip_leading_article(text: str, article: str | None) -> str:
    result = str(text or "").strip()
    article_str = str(article or "").strip()
    if not result or not article_str:
        return result

    article_norm = _normalize_article(article_str)
    exact_re = re.compile(rf"^{_escape_regex(article_str)}(?:\s+|$)", re.IGNORECASE)
    result = exact_re.sub("", result).strip()

    first_token = (result.split() or [""])[0]
    if article_norm and _normalize_article(first_token) == article_norm:
        result = " ".join(result.split()[1:]).strip()

    return result


def _strip_leading_brand(text: str, brand: str | None) -> str:
    brand_str = str(brand or "").strip()
    if not text or not brand_str:
        return str(text or "").strip()
    brand_re = re.compile(rf"^{_escape_regex(brand_str)}\s+", re.IGNORECASE)
    return brand_re.sub("", str(text)).strip()


def extract_product_description(raw_name: str | None, brand: str | None, article: str | None) -> str:
    name = str(raw_name or "").strip()
    if not name:
        return ""

    brand_str = str(brand or "").strip()
    article_str = str(article or "").strip()

    slash_parts = [part.strip() for part in name.split("/") if part.strip()]
    if len(slash_parts) >= 2:
        after_slash = " / ".join(slash_parts[1:]).strip()
        words = after_slash.split()
        if len(words) > 1:
            without_article = _strip_leading_article(after_slash, article_str)
            if without_article:
                return without_article
            return " ".join(words[1:]).strip()
        return _strip_leading_article(after_slash, article_str)

    if brand_str:
        brand_suffix_re = re.compile(rf"^(?:.+?\s+)?{_escape_regex(brand_str)}\s*", re.IGNORECASE)
        name = brand_suffix_re.sub("", name).strip()

    name = _strip_leading_article(name, article_str)
    name = _strip_leading_brand(name, brand_str)
    name = _strip_leading_article(name, article_str)
    return name.strip()


def format_product_display_title(
    brand: str | None,
    article: str | None,
    raw_name: str | None,
) -> str:
    brand_str = str(brand or "").strip()
    article_str = str(article or "").strip()
    raw = str(raw_name or "").strip()

    if not brand_str and not article_str:
        return raw or "Автозапчасть"

    description = extract_product_description(raw, brand_str, article_str) or raw
    parts = [brand_str, article_str, description]
    formatted = " ".join(part for part in parts if part).strip()
    return formatted or "Автозапчасть"
