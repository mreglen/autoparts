from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.utils.partnumber import normalize_partnumber

_TOKEN_SPLIT_RE = re.compile(r"[\s,;/]+")
_ARTICLE_HINT_RE = re.compile(r"\d")


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


def tokenize_search_query(q: str) -> list[str]:
    text = (q or "").strip()
    if not text:
        return []
    tokens = [t.strip() for t in _TOKEN_SPLIT_RE.split(text) if t.strip()]
    return tokens


def _looks_like_article(token: str) -> bool:
    cleaned = token.strip()
    if len(cleaned) < 2:
        return False
    if _ARTICLE_HINT_RE.search(cleaned):
        return True
    norm = normalize_partnumber(cleaned)
    if not norm or len(norm) < 3:
        return False
    has_latin = bool(re.search(r"[A-Za-z]", cleaned))
    has_digit = bool(re.search(r"\d", cleaned))
    return has_latin and has_digit


def _looks_like_brand(token: str) -> bool:
    cleaned = token.strip()
    if len(cleaned) < 2 or _looks_like_article(cleaned):
        return False
    if re.search(r"[а-яёА-ЯЁ]", cleaned):
        return False
    norm = normalize_partnumber(cleaned)
    if not norm or not norm.isalpha() or len(norm) > 24:
        return False
    return cleaned.isupper() or "-" in cleaned or "/" in cleaned


def _looks_like_name(token: str) -> bool:
    if _looks_like_article(token) or _looks_like_brand(token):
        return False
    return len(token.strip()) >= 2


@dataclass(frozen=True)
class ParsedSearchQuery:
    raw: str
    tokens: tuple[str, ...] = ()
    brand_article_pairs: tuple[tuple[str, str], ...] = ()
    article_tokens: tuple[str, ...] = ()
    brand_tokens: tuple[str, ...] = ()
    name_tokens: tuple[str, ...] = ()
    normalized_full: str = ""

    @property
    def has_terms(self) -> bool:
        return bool(self.tokens)


def parse_search_query(q: str) -> ParsedSearchQuery:
    """
    Разбирает поисковый запрос на возможные комбинации:
    бренд+артикул, артикул+бренд, название+бренд, название+артикул и т.д.
    """
    raw = (q or "").strip()
    tokens = tuple(tokenize_search_query(raw))
    if not tokens:
        return ParsedSearchQuery(raw=raw)

    normalized_full = normalize_partnumber(raw)
    pairs: list[tuple[str, str]] = []
    article_tokens: list[str] = []
    brand_tokens: list[str] = []
    name_tokens: list[str] = []

    # Классификация одиночных токенов.
    for token in tokens:
        if _looks_like_article(token):
            article_tokens.append(token)
        elif _looks_like_brand(token):
            brand_tokens.append(token)
        elif _looks_like_name(token):
            name_tokens.append(token)

    # Все пары подряд идущих токенов (brand+article и article+brand).
    if len(tokens) >= 2:
        for idx in range(len(tokens) - 1):
            left, right = tokens[idx], tokens[idx + 1]
            pairs.append((left, right))
            pairs.append((right, left))

    # Классическая схема: первый токен — бренд, остальное — артикул.
    legacy = parse_brand_article_from_query(raw)
    if legacy:
        pairs.insert(0, legacy)
        pairs.insert(1, (legacy[1], legacy[0]))

    # «BOSCH 0 451 103 073» — бренд + многословный артикул.
    if len(tokens) >= 2 and _looks_like_brand(tokens[0]):
        article_tail = " ".join(tokens[1:])
        if article_tail:
            pairs.insert(0, (tokens[0], article_tail))
            pairs.insert(1, (article_tail, tokens[0]))

    # Последний токен — артикул, остальное — бренд или название.
    if len(tokens) >= 2 and _looks_like_article(tokens[-1]):
        head = " ".join(tokens[:-1])
        if head:
            pairs.append((head, tokens[-1]))
            pairs.append((tokens[-1], head))

    # Первый токен — артикул, остальное — бренд/название.
    if len(tokens) >= 2 and _looks_like_article(tokens[0]):
        tail = " ".join(tokens[1:])
        if tail:
            pairs.append((tokens[0], tail))
            pairs.append((tail, tokens[0]))

    # Явные article/brand из классификации.
    for brand in brand_tokens:
        for article in article_tokens:
            pairs.append((brand, article))
            pairs.append((article, brand))

    # name + brand / name + article
    if name_tokens:
        name_text = " ".join(name_tokens)
        for brand in brand_tokens:
            pairs.append((brand, name_text))
            pairs.append((name_text, brand))
        for article in article_tokens:
            pairs.append((name_text, article))
            pairs.append((article, name_text))

    # Дедуп с сохранением порядка.
    seen: set[tuple[str, str]] = set()
    unique_pairs: list[tuple[str, str]] = []
    for pair in pairs:
        key = (pair[0].strip().casefold(), pair[1].strip().casefold())
        if not key[0] or not key[1] or key in seen:
            continue
        seen.add(key)
        unique_pairs.append(pair)

    return ParsedSearchQuery(
        raw=raw,
        tokens=tokens,
        brand_article_pairs=tuple(unique_pairs),
        article_tokens=tuple(dict.fromkeys(article_tokens)),
        brand_tokens=tuple(dict.fromkeys(brand_tokens)),
        name_tokens=tuple(name_tokens),
        normalized_full=normalized_full,
    )
