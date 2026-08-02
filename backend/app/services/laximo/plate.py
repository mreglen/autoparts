from __future__ import annotations

from fastapi import HTTPException, status

# Cyrillic plate letters used in RU plates (ГОСТ) and Latin lookalikes
_LATIN_TO_CYR = str.maketrans(
    {
        "A": "А",
        "B": "В",
        "E": "Е",
        "K": "К",
        "M": "М",
        "H": "Н",
        "O": "О",
        "P": "Р",
        "C": "С",
        "T": "Т",
        "Y": "У",
        "X": "Х",
    }
)

_ALLOWED = frozenset("АВЕКМНОРСТУХ0123456789")


def normalize_plate(plate: str | None) -> str:
    """Uppercase, strip spaces/dashes, map Latin lookalikes to Cyrillic."""
    if plate is None:
        return ""
    text = str(plate).strip().upper()
    text = text.replace(" ", "").replace("-", "").replace("–", "")
    text = text.translate(_LATIN_TO_CYR)
    return text


def looks_like_ru_plate(plate: str | None) -> bool:
    """Soft RU plate check: 6–12 alnum plate chars after normalize."""
    norm = normalize_plate(plate)
    if len(norm) < 6 or len(norm) > 12:
        return False
    return all(ch in _ALLOWED for ch in norm)


def normalize_plate_or_raise(plate: str | None) -> str:
    if plate is None or not str(plate).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Укажите государственный номер",
        )
    norm = normalize_plate(plate)
    if len(norm) < 6 or len(norm) > 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Госномер должен содержать от 6 до 12 символов",
        )
    if not all(ch in _ALLOWED for ch in norm):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Госномер содержит недопустимые символы",
        )
    return norm
