from __future__ import annotations

DEFAULT_OG_IMAGE_PATH = "/favicons/apple-touch-icon.png"


def resolve_default_og_image_url(site_origin: str) -> str:
    origin = (site_origin or "https://svoygarage.ru").rstrip("/")
    return f"{origin}{DEFAULT_OG_IMAGE_PATH}"
