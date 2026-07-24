from __future__ import annotations

import os

THUMB_IMAGE_MAX_SIZE = (400, 400)
THUMB_IMAGE_QUALITY = 75


def build_thumb_filename(final_filename: str) -> str:
    base, _ext = os.path.splitext(final_filename)
    return f"{base}_thumb.webp"


def build_thumb_media_path(media_path: str) -> str:
    """Build thumb URL next to the original media path (any image extension)."""
    path = (media_path or "").strip()
    if not path:
        return ""
    parent, name = os.path.split(path.rstrip("/"))
    thumb_name = build_thumb_filename(name or path)
    if not parent or parent == ".":
        return thumb_name if not path.startswith("/") else f"/{thumb_name}"
    return f"{parent}/{thumb_name}"
