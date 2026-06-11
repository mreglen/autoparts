from __future__ import annotations

import re

_TRANSLIT_MAP: dict[str, str] = {
    "а": "a",
    "б": "b",
    "в": "v",
    "г": "g",
    "д": "d",
    "е": "e",
    "ё": "yo",
    "ж": "zh",
    "з": "z",
    "и": "i",
    "й": "y",
    "к": "k",
    "л": "l",
    "м": "m",
    "н": "n",
    "о": "o",
    "п": "p",
    "р": "r",
    "с": "s",
    "т": "t",
    "у": "u",
    "ф": "f",
    "х": "kh",
    "ц": "ts",
    "ч": "ch",
    "ш": "sh",
    "щ": "sch",
    "ъ": "",
    "ы": "y",
    "ь": "",
    "э": "e",
    "ю": "yu",
    "я": "ya",
}

_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def transliterate_ru(text: str) -> str:
    """Transliterate Cyrillic (GOST-like) to Latin."""
    if not text:
        return ""
    result: list[str] = []
    for char in text:
        lower = char.lower()
        if lower in _TRANSLIT_MAP:
            mapped = _TRANSLIT_MAP[lower]
            if char.isupper() and mapped:
                if len(mapped) == 1:
                    mapped = mapped.upper()
                else:
                    mapped = mapped[0].upper() + mapped[1:]
            result.append(mapped)
        else:
            result.append(char)
    return "".join(result)


def _normalize_slug_text(text: str, *, preserve_hyphens: bool) -> str:
    text = transliterate_ru(text).lower()
    if preserve_hyphens:
        text = re.sub(r"[^a-z0-9\-]+", "-", text)
    else:
        text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-{2,}", "-", text)
    return text.strip("-")


def slugify(text: str) -> str:
    """Convert display text to URL slug: spaces/special chars -> hyphens."""
    return _normalize_slug_text(text, preserve_hyphens=False)


def slugify_brand(text: str) -> str:
    """Like slugify but keeps existing hyphens in Latin brand names."""
    return _normalize_slug_text(text, preserve_hyphens=True)


def is_valid_slug(slug: str) -> bool:
    return bool(slug and _SLUG_RE.fullmatch(slug))
