from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import exists, func, or_
from sqlalchemy.orm import Session, selectinload

from app.db.database import get_db
from app.models.organization import Organization
from app.models.product import Product as ProductModel, ProductPhoto
from app.models.vehicle import Vehicle as VehicleModel
from app.services.local_product_search import (
    build_search_relevance_score,
    search_local_products_query,
)
from app.schemas.product import ProductListItem
from app.core.config import settings
from app.utils.catalog_cache import build_catalog_cache_key
from app.utils.json_cache_sync import get_cached_json_sync, set_cached_json_sync
from app.utils.product_list_item import map_product_to_list_item

router = APIRouter(prefix="/catalog", tags=["Catalog"])

SORT_OPTIONS = {"created_at_desc", "price_asc", "price_desc"}

# Bump when list payload shape changes so Redis does not serve old full Product JSON.
CATALOG_PRODUCTS_CACHE_PREFIX = "catalog:products:v2"


class CatalogProductsResponse(BaseModel):
    items: List[ProductListItem]
    total: int
    page: int
    page_size: int


class CatalogFacetItem(BaseModel):
    value: str
    count: int


class CatalogFacetsResponse(BaseModel):
    brands: List[CatalogFacetItem]
    vehicle_brands: List[CatalogFacetItem]
    vehicle_models: List[CatalogFacetItem]


def _catalog_load_options():
    """Lean loads for list tiles — no videos / vehicles / part_type."""
    return [
        selectinload(ProductModel.photos),
        selectinload(ProductModel.storage_location),
        selectinload(ProductModel.organization),
    ]


def _apply_catalog_filters(
    query,
    *,
    is_new: Optional[bool],
    part_type_id: Optional[List[int]],
    brand: Optional[List[str]],
    price_min: Optional[float],
    price_max: Optional[float],
    storage_location_id: Optional[int],
    organization_id: Optional[str],
    has_photos: Optional[bool],
    vehicle_brand: Optional[List[str]],
    vehicle_model: Optional[List[str]],
    vehicle_id: Optional[int],
    city: Optional[str] = None,
):
    if is_new is not None:
        query = query.filter(ProductModel.is_new == is_new)
    if part_type_id:
        part_type_ids = [pt for pt in part_type_id if pt is not None]
        if part_type_ids:
            query = query.filter(ProductModel.part_type_id.in_(part_type_ids))
    if brand:
        brands = [b.strip() for b in brand if b and b.strip()]
        if brands:
            query = query.filter(ProductModel.brand.in_(brands))
    if price_min is not None:
        query = query.filter(ProductModel.price >= price_min)
    if price_max is not None:
        query = query.filter(ProductModel.price <= price_max)
    if storage_location_id is not None:
        query = query.filter(ProductModel.storage_location_id == storage_location_id)
    if organization_id is not None:
        query = query.filter(ProductModel.organization_id == organization_id)
    city_text = (city or "").strip()
    if len(city_text) >= 2:
        query = query.join(Organization, ProductModel.organization_id == Organization.id)
        query = query.filter(Organization.address.ilike(f"%{city_text}%"))
    if has_photos:
        query = query.filter(
            exists().where(ProductPhoto.product_id == ProductModel.id)
        )
    if vehicle_id is not None or vehicle_brand or vehicle_model:
        query = query.join(ProductModel.compatible_vehicles)
        if vehicle_id is not None:
            query = query.filter(VehicleModel.id == vehicle_id)
        vehicle_brands = [b.strip() for b in (vehicle_brand or []) if b and b.strip()]
        if vehicle_brands:
            query = query.filter(VehicleModel.brand.in_(vehicle_brands))
        vehicle_models = [m.strip() for m in (vehicle_model or []) if m and m.strip()]
        if vehicle_models:
            query = query.filter(VehicleModel.model.in_(vehicle_models))
        query = query.distinct()
    return query


def _in_stock_filter():
    """Товары в наличии: quantity > 0 (NULL считаем нулём)."""
    return func.coalesce(ProductModel.quantity, 0) > 0


def _apply_sort(query, sort: str, *, relevance=None):
    if sort == "price_asc":
        return query.order_by(ProductModel.price.asc().nulls_last(), ProductModel.id.desc())
    if sort == "price_desc":
        return query.order_by(ProductModel.price.desc().nulls_last(), ProductModel.id.desc())
    if relevance is not None:
        return query.order_by(relevance.desc(), ProductModel.id.desc())
    return query.order_by(ProductModel.id.desc())


@router.get("/products", response_model=CatalogProductsResponse)
def list_catalog_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort: str = Query("created_at_desc"),
    q: Optional[str] = None,
    is_new: Optional[bool] = None,
    part_type_id: Optional[List[int]] = Query(None),
    brand: Optional[List[str]] = Query(None),
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    storage_location_id: Optional[int] = None,
    organization_id: Optional[str] = None,
    has_photos: Optional[bool] = None,
    vehicle_brand: Optional[List[str]] = Query(None),
    vehicle_model: Optional[List[str]] = Query(None),
    vehicle_id: Optional[int] = None,
    city: Optional[str] = None,
    db: Session = Depends(get_db),
):
    if sort not in SORT_OPTIONS:
        sort = "created_at_desc"

    cache_key = build_catalog_cache_key(
        CATALOG_PRODUCTS_CACHE_PREFIX,
        page=page,
        page_size=page_size,
        sort=sort,
        q=q.strip() if q else None,
        is_new=is_new,
        part_type_id=part_type_id,
        brand=brand,
        price_min=price_min,
        price_max=price_max,
        storage_location_id=storage_location_id,
        organization_id=organization_id,
        has_photos=has_photos,
        vehicle_brand=vehicle_brand,
        vehicle_model=vehicle_model,
        vehicle_id=vehicle_id,
        city=city,
    )
    cached = get_cached_json_sync(cache_key)
    if cached is not None:
        return cached

    trimmed_q = q.strip() if q else ""
    search_relevance = build_search_relevance_score(trimmed_q) if trimmed_q else None
    if trimmed_q:
        query = search_local_products_query(
            db,
            trimmed_q,
            is_new=is_new,
            limit=None,
            apply_order=False,
        )
    else:
        query = (
            db.query(ProductModel)
            .options(*_catalog_load_options())
            .filter(_in_stock_filter())
        )
        if is_new is not None:
            query = query.filter(ProductModel.is_new == is_new)

    for opt in _catalog_load_options():
        if trimmed_q:
            query = query.options(opt)

    query = _apply_catalog_filters(
        query,
        is_new=is_new if trimmed_q else None,
        part_type_id=part_type_id,
        brand=brand,
        price_min=price_min,
        price_max=price_max,
        storage_location_id=storage_location_id,
        organization_id=organization_id,
        has_photos=has_photos,
        vehicle_brand=vehicle_brand,
        vehicle_model=vehicle_model,
        vehicle_id=vehicle_id,
        city=city,
    )

    count_query = query.order_by(None)
    id_subq = count_query.with_entities(ProductModel.id).distinct().subquery()
    total = db.query(func.count()).select_from(id_subq).scalar() or 0
    query = _apply_sort(query, sort, relevance=search_relevance)
    offset = (page - 1) * page_size
    products = query.offset(offset).limit(page_size).all()
    items = [map_product_to_list_item(product, db=db) for product in products]

    response = CatalogProductsResponse(
        items=items,
        total=int(total),
        page=page,
        page_size=page_size,
    )
    set_cached_json_sync(
        cache_key,
        response.model_dump(mode="json"),
        settings.CATALOG_CACHE_TTL_SECONDS,
    )
    return response


@router.get("/facets", response_model=CatalogFacetsResponse)
def get_catalog_facets(
    is_new: Optional[bool] = None,
    limit: int = Query(30, ge=1, le=100),
    vehicle_brand: Optional[str] = None,
    city: Optional[str] = None,
    db: Session = Depends(get_db),
):
    cache_key = build_catalog_cache_key(
        "catalog:facets",
        is_new=is_new,
        limit=limit,
        vehicle_brand=vehicle_brand,
        city=city,
    )
    cached = get_cached_json_sync(cache_key)
    if cached is not None:
        return cached

    brand_q = db.query(ProductModel.brand, func.count(ProductModel.id)).filter(
        _in_stock_filter(),
        ProductModel.brand.isnot(None),
        ProductModel.brand != "",
    )
    if is_new is not None:
        brand_q = brand_q.filter(ProductModel.is_new == is_new)
    city_text = (city or "").strip()
    if len(city_text) >= 2:
        brand_q = brand_q.join(Organization, ProductModel.organization_id == Organization.id)
        brand_q = brand_q.filter(Organization.address.ilike(f"%{city_text}%"))
    brand_rows = (
        brand_q
        .group_by(ProductModel.brand)
        .order_by(func.count(ProductModel.id).desc())
        .limit(limit)
        .all()
    )

    vehicle_q = (
        db.query(VehicleModel.brand, func.count(func.distinct(ProductModel.id)))
        .join(ProductModel.compatible_vehicles)
        .filter(_in_stock_filter())
    )
    if is_new is not None:
        vehicle_q = vehicle_q.filter(ProductModel.is_new == is_new)
    vehicle_brand_rows = (
        vehicle_q.group_by(VehicleModel.brand)
        .order_by(func.count(func.distinct(ProductModel.id)).desc())
        .limit(limit)
        .all()
    )

    model_q = (
        db.query(VehicleModel.model, func.count(func.distinct(ProductModel.id)))
        .join(ProductModel.compatible_vehicles)
        .filter(_in_stock_filter())
    )
    if is_new is not None:
        model_q = model_q.filter(ProductModel.is_new == is_new)
    if vehicle_brand and vehicle_brand.strip():
        model_q = model_q.filter(VehicleModel.brand.ilike(f"%{vehicle_brand.strip()}%"))
    vehicle_model_rows = (
        model_q.group_by(VehicleModel.model)
        .order_by(func.count(func.distinct(ProductModel.id)).desc())
        .limit(limit)
        .all()
    )

    response = CatalogFacetsResponse(
        brands=[CatalogFacetItem(value=r[0], count=int(r[1])) for r in brand_rows if r[0]],
        vehicle_brands=[
            CatalogFacetItem(value=r[0], count=int(r[1])) for r in vehicle_brand_rows if r[0]
        ],
        vehicle_models=[
            CatalogFacetItem(value=r[0], count=int(r[1])) for r in vehicle_model_rows if r[0]
        ],
    )
    set_cached_json_sync(
        cache_key,
        response.model_dump(mode="json"),
        settings.CATALOG_FACETS_CACHE_TTL_SECONDS,
    )
    return response
