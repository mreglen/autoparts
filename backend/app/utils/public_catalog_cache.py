from __future__ import annotations

import logging

from app.utils.redis_sync import get_redis_sync

logger = logging.getLogger(__name__)

# Префиксы Redis-ключей публичного каталога (см. catalog.py, products.py, search_cache.py)
_PUBLIC_CACHE_PREFIXES = (
    "catalog:products:",
    "catalog:facets:",
    "products:public:",
    "search:",
)


def _delete_by_prefix(prefix: str) -> int:
    deleted = 0
    try:
        client = get_redis_sync()
        for key in client.scan_iter(match=f"{prefix}*", count=200):
            deleted += int(client.delete(key) or 0)
    except Exception as exc:
        logger.warning("Redis cache invalidation failed for prefix %s: %s", prefix, exc)
    return deleted


def invalidate_public_catalog_cache() -> None:
    """Сброс кэша публичного каталога после изменения товаров."""
    total = 0
    for prefix in _PUBLIC_CACHE_PREFIXES:
        total += _delete_by_prefix(prefix)
    if total:
        logger.info("Invalidated %s public catalog cache keys", total)


def invalidate_public_product_detail(product_id: int) -> None:
    try:
        get_redis_sync().delete(f"products:public:detail:{int(product_id)}")
    except Exception as exc:
        logger.warning("Redis delete failed for product detail %s: %s", product_id, exc)


def invalidate_public_products_for_storage_location(db, storage_location_id: int) -> None:
    """Invalidate cached public product cards tied to a warehouse."""
    from app.models.product import Product

    try:
        product_ids = (
            db.query(Product.id)
            .filter(Product.storage_location_id == int(storage_location_id))
            .all()
        )
    except Exception as exc:
        logger.warning(
            "Failed to load products for storage location %s: %s",
            storage_location_id,
            exc,
        )
        return

    for (product_id,) in product_ids:
        invalidate_public_product_detail(product_id)
