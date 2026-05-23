from urllib.parse import quote


def build_product_page_url(product, site_origin: str) -> str:
    brand = quote((getattr(product, "brand", None) or "").strip(), safe="")
    article = quote((getattr(product, "article", None) or "").strip(), safe="")
    product_id = getattr(product, "id", None)
    if product_id and brand and article:
        return f"{site_origin.rstrip('/')}/part/{product_id}-{brand}-{article}"
    if product_id:
        return f"{site_origin.rstrip('/')}/part/{product_id}"
    return site_origin.rstrip("/")
