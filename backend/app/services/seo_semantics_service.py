from __future__ import annotations

from app.utils.slug_utils import slugify_brand


def resolve_single_brand_landing_path(
    section: str,
    brands: list[str] | None,
    *,
    has_text_query: bool = False,
) -> str | None:
    """If listing has exactly one brand filter and no text query, return brand landing path."""
    if has_text_query:
        return None
    cleaned = [b.strip() for b in (brands or []) if b and str(b).strip()]
    if len(cleaned) != 1:
        return None
    slug = slugify_brand(cleaned[0])
    if not slug:
        return None
    return f"/autoparts/{section}/brand/{slug}"


def classify_query_cluster(query_text: str) -> str:
    text = (query_text or "").strip().lower()
    if not text:
        return "unknown"
    geo_markers = (
        "екатеринбург",
        "екб",
        "свердловск",
        "свердловская",
        "автозапчасти екат",
        "разборка",
    )
    if any(marker in text for marker in geo_markers):
        return "D"
    category_markers = (
        "тормоз",
        "колодк",
        "амортиз",
        "фильтр",
        "свеч",
        "генератор",
        "стартер",
        "рейка",
        "крыло",
        "бампер",
    )
    if any(marker in text for marker in category_markers):
        return "C"
    buy_markers = ("купить", "цена", "стоимость", "артикул", "оригинал")
    if any(marker in text for marker in buy_markers) and any(ch.isdigit() for ch in text):
        return "A"
    if any(marker in text for marker in buy_markers):
        return "A"
    brand_markers = ("автозапчасти", "запчасти", "новые запчасти", "б/у запчасти", "б у запчасти")
    if any(marker in text for marker in brand_markers):
        return "B"
    return "unknown"
