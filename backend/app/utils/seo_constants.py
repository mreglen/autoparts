from __future__ import annotations

DEFAULT_OG_IMAGE_PATH = "/favicons/apple-touch-icon.png"
# Фолбэк для карточек без фото: лого сайта на белом фоне (для JSON-LD/микроразметки).
PRODUCT_PLACEHOLDER_IMAGE_PATH = "/img/product-placeholder-white.png"
# Для meta property="product:price:amount" и др. — иначе RDFa-валидатор ругается на неизвестный префикс.
HTML_OG_PRODUCT_PREFIX = 'og: http://ogp.me/ns# product: http://ogp.me/ns/product#'


def resolve_default_og_image_url(site_origin: str) -> str:
    origin = (site_origin or "https://svoygarage.ru").rstrip("/")
    return f"{origin}{DEFAULT_OG_IMAGE_PATH}"


def resolve_product_placeholder_image_url(site_origin: str) -> str:
    origin = (site_origin or "https://svoygarage.ru").rstrip("/")
    return f"{origin}{PRODUCT_PLACEHOLDER_IMAGE_PATH}"
