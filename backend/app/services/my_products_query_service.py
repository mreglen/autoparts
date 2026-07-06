from typing import Optional

from sqlalchemy import func, or_

from app.models.product import Product as ProductModel
from app.models.product_storage_cell import ProductStorageCell as ProductStorageCellModel


def apply_my_products_search(query, q: str):
    trimmed = (q or "").strip()
    if not trimmed:
        return query
    compact = trimmed.lower().replace(" ", "")
    pattern = f"%{trimmed.lower()}%"
    compact_pattern = f"%{compact}%"
    return query.filter(
        or_(
            func.lower(ProductModel.name).like(pattern),
            func.lower(func.coalesce(ProductModel.article, "")).like(pattern),
            func.replace(func.lower(func.coalesce(ProductModel.article, "")), " ", "").like(compact_pattern),
            func.replace(func.lower(func.coalesce(ProductModel.internal_code, "")), " ", "").like(compact_pattern),
        )
    )


def apply_my_products_filters(
    query,
    storage_location_id: Optional[int] = None,
    storage_cell_id: Optional[int] = None,
    q: str = "",
):
    if storage_location_id is not None:
        query = query.filter(ProductModel.storage_location_id == storage_location_id)
    if storage_cell_id is not None:
        cell_product_ids = (
            query.session.query(ProductStorageCellModel.product_id)
            .filter(ProductStorageCellModel.storage_cell_id == storage_cell_id)
        )
        query = query.filter(ProductModel.id.in_(cell_product_ids))
    return apply_my_products_search(query, q)


def apply_my_products_sort(query, sort: str):
    if sort == "date_asc":
        return query.order_by(ProductModel.id.asc())
    if sort == "name_asc":
        return query.order_by(ProductModel.name.asc(), ProductModel.id.asc())
    if sort == "name_desc":
        return query.order_by(ProductModel.name.desc(), ProductModel.id.desc())
    if sort == "price_asc":
        return query.order_by(ProductModel.price.asc().nulls_last(), ProductModel.id.asc())
    if sort == "price_desc":
        return query.order_by(ProductModel.price.desc().nulls_first(), ProductModel.id.desc())
    return query.order_by(ProductModel.id.desc())
