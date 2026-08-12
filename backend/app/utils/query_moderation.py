from __future__ import annotations

import re

from app.services.laximo.vin import (
    normalize_vin_for_search_or_none,
    normalize_vin_or_none,
)

# Roots/substrings unlikely in legitimate part searches; checked on compacted text.
_PROFANITY_ROOTS = (
    "бляд",
    "блят",
    "бля",
    "хуй",
    "хуя",
    "хуе",
    "хуи",
    "хую",
    "пизд",
    "пезд",
    "ебан",
    "ебат",
    "ебл",
    "ебал",
    "ебуч",
    "ёб",
    "сука",
    "сучк",
    "мудак",
    "мудил",
    "пидор",
    "пидар",
    "педик",
    "говн",
    "залуп",
    "дроч",
    "fuck",
    "shit",
    "bitch",
)

_TOKEN_SPLIT_RE = re.compile(r"[\s,;/]+")


def _compact_text(text: str) -> str:
    """Lowercase, ё→е, strip separators/punctuation for substring checks."""
    lowered = (text or "").casefold().replace("ё", "е")
    return re.sub(r"[^a-zа-я0-9]+", "", lowered)


def contains_profanity(value: str | None) -> bool:
    """True if query contains obvious profanity (RU/EN roots)."""
    text = (value or "").strip()
    if not text:
        return False

    compact_full = _compact_text(text)
    if compact_full:
        for root in _PROFANITY_ROOTS:
            if root in compact_full:
                return True

    for token in _TOKEN_SPLIT_RE.split(text):
        token = token.strip()
        if not token:
            continue
        compact_token = _compact_text(token)
        if not compact_token:
            continue
        for root in _PROFANITY_ROOTS:
            if root in compact_token:
                return True
    return False


def query_contains_vin(value: str | None) -> bool:
    """True if query is a VIN lookup, not a brand/article search."""
    text = (value or "").strip()
    if not text:
        return False

    if normalize_vin_for_search_or_none(text) is not None:
        return True

    tokens = [token.strip() for token in _TOKEN_SPLIT_RE.split(text) if token.strip()]
    if len(tokens) <= 1:
        return False

    return any(normalize_vin_or_none(token) for token in tokens)


def is_allowed_popular_query(value: str | None) -> bool:
    """Popular query chips must not expose VIN lookups or profanity."""
    text = (value or "").strip()
    if not text:
        return False
    if query_contains_vin(text):
        return False
    if contains_profanity(text):
        return False
    return True
