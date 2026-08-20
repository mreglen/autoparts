from __future__ import annotations

from fastapi import HTTPException, status

# ISO 3779 is 17 chars; Russian catalogs (Rossko, Laximo, etc.) also accept
# shorter chassis/VIN prefixes commonly pasted from docs (11–16).
VIN_MIN_LENGTH = 11
VIN_MAX_LENGTH = 17

# ISO 3779: VIN uses A–Z and 0–9 except I, O, Q
_VIN_FORBIDDEN = frozenset("IOQ")
_VIN_ALLOWED = frozenset("ABCDEFGHJKLMNPRSTUVWXYZ0123456789")
_RELAXED_VIN_ALLOWED = frozenset("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")

# Cyrillic lookalikes typed on a RU keyboard → Latin VIN letters
_CYR_TO_LATIN = str.maketrans(
    {
        "А": "A",
        "В": "B",
        "Е": "E",
        "К": "K",
        "М": "M",
        "Н": "H",
        "О": "O",
        "Р": "P",
        "С": "C",
        "Т": "T",
        "У": "Y",
        "Х": "X",
    }
)

_SEPARATORS = (" ", "\t", "\r", "\n", "-", "–", "—", "_", ".", "/", "\\")

# Heuristics: long part numbers often look like VIN charset but are mostly digits.
_SHORT_VIN_MAX_DIGIT_RATIO = 0.65
_SHORT_VIN_MIN_LETTERS = 3
_FULL_VIN_MIN_LETTERS = 3

_TOKEN_SPLIT = frozenset((" ", "\t", "\r", "\n", ",", ";", "/"))
_VIN_FRAGMENT_MAX_LEN = 8


def normalize_vin(vin: str | None) -> str:
    """Uppercase, strip separators, map Cyrillic lookalikes to Latin. No validation."""
    if vin is None:
        return ""
    text = str(vin).strip().upper().translate(_CYR_TO_LATIN)
    for sep in _SEPARATORS:
        text = text.replace(sep, "")
    return text


def _letter_and_digit_stats(norm: str) -> tuple[int, int]:
    letters = sum(1 for ch in norm if ch.isalpha())
    digits = sum(1 for ch in norm if ch.isdigit())
    return letters, digits


def _looks_like_part_number(norm: str) -> bool:
    """Reject strings that resemble long catalog numbers rather than VIN/chassis."""
    length = len(norm)
    if length < VIN_MIN_LENGTH:
        return True

    letters, digits = _letter_and_digit_stats(norm)
    if letters < _FULL_VIN_MIN_LETTERS:
        return True

    if length < VIN_MAX_LENGTH:
        if letters < _SHORT_VIN_MIN_LETTERS:
            return True
        total = letters + digits
        if total > 0 and digits / total >= _SHORT_VIN_MAX_DIGIT_RATIO:
            return True

    return False


def looks_like_vin(vin: str | None) -> bool:
    """True if string is a plausible VIN/chassis for catalog lookup. No HTTPException."""
    norm = normalize_vin(vin)
    if not (VIN_MIN_LENGTH <= len(norm) <= VIN_MAX_LENGTH):
        return False
    if any(ch in _VIN_FORBIDDEN for ch in norm):
        return False
    if not all(ch in _VIN_ALLOWED for ch in norm):
        return False
    # Require at least one letter so pure numeric strings are not treated as VIN
    if not any(ch.isalpha() for ch in norm):
        return False
    if _looks_like_part_number(norm):
        return False
    return True


def _split_search_tokens(value: str) -> list[str]:
    text = str(value or "").strip()
    if not text:
        return []
    for sep in _TOKEN_SPLIT:
        text = text.replace(sep, " ")
    return [token.strip() for token in text.split() if token.strip()]


def _token_looks_like_brand_word(token: str) -> bool:
    return len(token) >= 4 and token.isalpha() and token.isascii()


def _resolve_vin_for_lookup(norm: str) -> str | None:
    """Strict ISO VIN after optional I/O/Q OCR fixes (1/0)."""
    for candidate in (norm, _rewrite_common_vin_ocr_confusions(norm)):
        if looks_like_vin(candidate):
            return candidate
    return None


def normalize_vin_for_lookup_or_none(value: str | None) -> str | None:
    norm = normalize_vin(value)
    if not (VIN_MIN_LENGTH <= len(norm) <= VIN_MAX_LENGTH):
        return None
    return _resolve_vin_for_lookup(norm)


def normalize_vin_for_search_or_none(value: str | None) -> str | None:
    """
    VIN normalization for global search: ignore brand+article queries and other
    false positives that sanitize to a VIN-shaped string.
    """
    text = str(value or "").strip()
    if not text:
        return None

    tokens = _split_search_tokens(text)
    if len(tokens) > 1:
        if any(_token_looks_like_brand_word(token) for token in tokens):
            return None
        joined = "".join(tokens)
        if not all(1 <= len(token) <= _VIN_FRAGMENT_MAX_LEN and token.isalnum() for token in tokens):
            return None
        return _resolve_vin_for_lookup(joined)

    if any(sep in text for sep in ("/", "\\", ".", "_")):
        return None

    return normalize_vin_for_lookup_or_none(text)


def normalize_vin_or_none(vin: str | None) -> str | None:
    if not looks_like_vin(vin):
        return None
    return normalize_vin(vin)


def _rewrite_common_vin_ocr_confusions(norm: str) -> str:
    """I/O/Q are invalid in ISO VIN but often confused with 1/0 on plates and scans."""
    return norm.replace("O", "0").replace("Q", "0").replace("I", "1")


def _looks_like_relaxed_chassis(norm: str) -> bool:
    if not (VIN_MIN_LENGTH <= len(norm) <= VIN_MAX_LENGTH):
        return False
    if not all(ch in _RELAXED_VIN_ALLOWED for ch in norm):
        return False
    if not any(ch.isalpha() for ch in norm):
        return False
    if _looks_like_part_number(norm):
        return False
    return True


def normalize_vin_for_lookup_or_raise(vin: str | None) -> str:
    """Validate VIN for Laximo catalog lookup; fixes common I/O/Q OCR typos."""
    if vin is None or not str(vin).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"VIN должен содержать от {VIN_MIN_LENGTH} до {VIN_MAX_LENGTH} символов",
        )
    norm = normalize_vin(vin)
    if not (VIN_MIN_LENGTH <= len(norm) <= VIN_MAX_LENGTH):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"VIN должен содержать от {VIN_MIN_LENGTH} до {VIN_MAX_LENGTH} символов",
        )
    resolved = _resolve_vin_for_lookup(norm)
    if resolved is not None:
        return resolved
    if any(ch in _VIN_FORBIDDEN for ch in norm):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VIN не должен содержать буквы I, O или Q",
        )
    if not all(ch in _VIN_ALLOWED for ch in norm):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VIN должен содержать только латинские буквы и цифры",
        )
    if not any(ch.isalpha() for ch in norm):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VIN должен содержать хотя бы одну букву",
        )
    if _looks_like_part_number(norm):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Строка похожа на артикул, а не на VIN",
        )
    return norm


def normalize_garage_vin_or_raise(vin: str | None) -> str:
    """
    Validate VIN/chassis for garage storage.
    Accepts ISO VINs, common I/O/Q OCR typos, and other plausible chassis numbers.
    """
    if vin is None or not str(vin).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"VIN должен содержать от {VIN_MIN_LENGTH} до {VIN_MAX_LENGTH} символов",
        )
    norm = normalize_vin(vin)
    if not (VIN_MIN_LENGTH <= len(norm) <= VIN_MAX_LENGTH):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"VIN должен содержать от {VIN_MIN_LENGTH} до {VIN_MAX_LENGTH} символов",
        )

    resolved = _resolve_vin_for_lookup(norm)
    if resolved is not None:
        return resolved

    if _looks_like_relaxed_chassis(norm):
        return norm

    if any(ch in _VIN_FORBIDDEN for ch in norm):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VIN не должен содержать буквы I, O или Q",
        )
    if not all(ch in _VIN_ALLOWED for ch in norm):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VIN должен содержать только латинские буквы и цифры",
        )
    if not any(ch.isalpha() for ch in norm):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VIN должен содержать хотя бы одну букву",
        )
    if _looks_like_part_number(norm):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Строка похожа на артикул, а не на VIN",
        )
    return norm


def normalize_vin_or_raise(vin: str | None) -> str:
    if vin is None or not str(vin).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"VIN должен содержать от {VIN_MIN_LENGTH} до {VIN_MAX_LENGTH} символов",
        )
    norm = normalize_vin(vin)
    if not (VIN_MIN_LENGTH <= len(norm) <= VIN_MAX_LENGTH):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"VIN должен содержать от {VIN_MIN_LENGTH} до {VIN_MAX_LENGTH} символов",
        )
    if any(ch in _VIN_FORBIDDEN for ch in norm):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VIN не должен содержать буквы I, O или Q",
        )
    if not all(ch in _VIN_ALLOWED for ch in norm):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VIN должен содержать только латинские буквы и цифры",
        )
    if not any(ch.isalpha() for ch in norm):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VIN должен содержать хотя бы одну букву",
        )
    if _looks_like_part_number(norm):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Строка похожа на артикул, а не на VIN",
        )
    return norm
