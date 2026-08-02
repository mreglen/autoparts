from __future__ import annotations

import re

from fastapi import HTTPException, status

# Frame codes like SGL5-400683 / XZU4230001026 — alnum + hyphen
_FRAME_RE = re.compile(r"^[A-Z0-9-]{6,32}$")


def normalize_frame(frame: str | None) -> str:
    """Uppercase, strip spaces; keep hyphens (e.g. SGL5-400683)."""
    if frame is None:
        return ""
    text = str(frame).strip().upper()
    text = text.replace(" ", "").replace("–", "-").replace("—", "-")
    return text


def looks_like_frame(frame: str | None) -> bool:
    norm = normalize_frame(frame)
    if not norm or not _FRAME_RE.match(norm):
        return False
    return True


def normalize_frame_or_raise(frame: str | None) -> str:
    if frame is None or not str(frame).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Укажите Frame (номер кузова)",
        )
    norm = normalize_frame(frame)
    if len(norm) < 6 or len(norm) > 32:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Frame должен содержать от 6 до 32 символов",
        )
    if not _FRAME_RE.match(norm):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Frame содержит недопустимые символы",
        )
    return norm
