from __future__ import annotations

from fastapi import HTTPException, status

# ISO 3779 is 17 chars; Russian catalogs (Rossko, Laximo, etc.) also accept
# shorter chassis/VIN prefixes commonly pasted from docs (11–16).
VIN_MIN_LENGTH = 11
VIN_MAX_LENGTH = 17

# ISO 3779: VIN uses A–Z and 0–9 except I, O, Q
_VIN_FORBIDDEN = frozenset("IOQ")


def looks_like_vin(vin: str | None) -> bool:
    """True if string is a plausible VIN/chassis for catalog lookup. No HTTPException."""
    if vin is None or not str(vin).strip():
        return False
    norm = str(vin).strip().upper()
    if not (VIN_MIN_LENGTH <= len(norm) <= VIN_MAX_LENGTH):
        return False
    if any(ch in _VIN_FORBIDDEN for ch in norm):
        return False
    if not all(ch.isalnum() for ch in norm):
        return False
    # Require at least one letter so pure numeric strings are not treated as VIN
    if not any(ch.isalpha() for ch in norm):
        return False
    return True


def normalize_vin_or_none(vin: str | None) -> str | None:
    if not looks_like_vin(vin):
        return None
    return str(vin).strip().upper()


def normalize_vin_or_raise(vin: str | None) -> str:
    if vin is None or not str(vin).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"VIN должен содержать от {VIN_MIN_LENGTH} до {VIN_MAX_LENGTH} символов",
        )
    norm = str(vin).strip().upper()
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
    if not all(ch.isalnum() for ch in norm):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VIN должен содержать только латинские буквы и цифры",
        )
    if not any(ch.isalpha() for ch in norm):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VIN должен содержать хотя бы одну букву",
        )
    return norm
