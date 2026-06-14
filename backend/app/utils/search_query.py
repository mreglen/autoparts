from __future__ import annotations


def parse_brand_article_from_query(q: str) -> tuple[str, str] | None:
    """
    Разбирает запрос вида «BOSCH 0 451 103 073» или «MANN-FILTER IF1009»
    на бренд и артикул (всё после первого пробела — артикул).
    """
    text = (q or "").strip()
    if not text:
        return None
    parts = text.split(None, 1)
    if len(parts) < 2:
        return None
    brand, article = parts[0].strip(), parts[1].strip()
    if not brand or not article:
        return None
    return brand, article
