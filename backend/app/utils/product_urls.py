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


def build_product_used_catalog_search_query(product) -> str:
    brand = (getattr(product, "brand", None) or "").strip()
    article = (getattr(product, "article", None) or "").strip()
    if brand and article:
        return f"{brand} {article}"
    return article or brand


def build_product_used_catalog_url(product, site_origin: str) -> str:
    query = build_product_used_catalog_search_query(product)
    return build_used_catalog_url_for_query(site_origin, query)


def build_used_catalog_url_for_query(site_origin: str, q: str) -> str:
    origin = site_origin.rstrip("/")
    query = (q or "").strip()
    if not query:
        return f"{origin}/autoparts/used"
    return f"{origin}/autoparts/used?q={quote(query, safe='')}"
