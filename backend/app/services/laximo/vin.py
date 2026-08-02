from __future__ import annotations

from fastapi import HTTPException, status

# ISO 3779: VIN uses A–Z and 0–9 except I, O, Q
_VIN_FORBIDDEN = frozenset("IOQ")


def looks_like_vin(vin: str | None) -> bool:
    """True if string is a plausible VIN (17 chars, no I/O/Q). No HTTPException."""
    if vin is None or not str(vin).strip():
        return False
    norm = str(vin).strip().upper()
    if len(norm) != 17:
        return False
    if any(ch in _VIN_FORBIDDEN for ch in norm):
        return False
    if not all(ch.isalnum() for ch in norm):
        return False
    # Require at least one letter so pure numeric 17-digit strings are not treated as VIN
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
            detail="VIN должен содержать ровно 17 символов",
        )
    norm = str(vin).strip().upper()
    if len(norm) != 17:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VIN должен содержать ровно 17 символов",
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
    return norm
