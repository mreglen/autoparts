from __future__ import annotations

import os

THUMB_IMAGE_MAX_SIZE = (400, 400)
THUMB_IMAGE_QUALITY = 75


def build_thumb_filename(final_filename: str) -> str:
    base, _ext = os.path.splitext(final_filename)
    return f"{base}_thumb.webp"


def build_thumb_media_path(media_path: str) -> str:
    if media_path.endswith(".webp"):
        return f"{media_path[:-5]}_thumb.webp"
    return f"{media_path}_thumb.webp"
