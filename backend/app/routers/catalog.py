from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import exists, func, or_
from sqlalchemy.orm import Session, selectinload

from app.db.database import get_db
from app.models.product import Product as ProductModel, ProductPhoto
from app.models.vehicle import Vehicle as VehicleModel
from app.routers.search_products import search_local_products_query
from app.schemas.product import Product as ProductSchema

router = APIRouter(prefix="/catalog", tags=["Catalog"])

SORT_OPTIONS = {"created_at_desc", "price_asc", "price_desc"}


class CatalogProductsResponse(BaseModel):
    items: List[ProductSchema]
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
    return [
        selectinload(ProductModel.photos),
        selectinload(ProductModel.videos),
        selectinload(ProductModel.storage_location),
        selectinload(ProductModel.organization),
        selectinload(ProductModel.part_type),
        selectinload(ProductModel.compatible_vehicles),
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


def _apply_sort(query, sort: str):
    if sort == "price_asc":
        return query.order_by(ProductModel.price.asc().nulls_last(), ProductModel.id.desc())
    if sort == "price_desc":
        return query.order_by(ProductModel.price.desc().nulls_last(), ProductModel.id.desc())
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
    db: Session = Depends(get_db),
):
    if sort not in SORT_OPTIONS:
        sort = "created_at_desc"

    trimmed_q = q.strip() if q else ""
    if trimmed_q:
        query = search_local_products_query(db, trimmed_q, is_new=is_new)
    else:
        query = (
            db.query(ProductModel)
            .options(*_catalog_load_options())
            .filter(ProductModel.quantity > 0)
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
    )

    id_subq = query.with_entities(ProductModel.id).distinct().subquery()
    total = db.query(func.count()).select_from(id_subq).scalar() or 0
    query = _apply_sort(query, sort)
    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()

    return CatalogProductsResponse(
        items=items,
        total=int(total),
        page=page,
        page_size=page_size,
    )


@router.get("/facets", response_model=CatalogFacetsResponse)
def get_catalog_facets(
    is_new: bool = False,
    limit: int = Query(30, ge=1, le=100),
    vehicle_brand: Optional[str] = None,
    db: Session = Depends(get_db),
):
    brand_rows = (
        db.query(ProductModel.brand, func.count(ProductModel.id))
        .filter(
            ProductModel.quantity > 0,
            ProductModel.is_new == is_new,
            ProductModel.brand.isnot(None),
            ProductModel.brand != "",
        )
        .group_by(ProductModel.brand)
        .order_by(func.count(ProductModel.id).desc())
        .limit(limit)
        .all()
    )

    vehicle_q = (
        db.query(VehicleModel.brand, func.count(func.distinct(ProductModel.id)))
        .join(ProductModel.compatible_vehicles)
        .filter(ProductModel.quantity > 0, ProductModel.is_new == is_new)
    )
    vehicle_brand_rows = (
        vehicle_q.group_by(VehicleModel.brand)
        .order_by(func.count(func.distinct(ProductModel.id)).desc())
        .limit(limit)
        .all()
    )

    model_q = (
        db.query(VehicleModel.model, func.count(func.distinct(ProductModel.id)))
        .join(ProductModel.compatible_vehicles)
        .filter(ProductModel.quantity > 0, ProductModel.is_new == is_new)
    )
    if vehicle_brand and vehicle_brand.strip():
        model_q = model_q.filter(VehicleModel.brand.ilike(f"%{vehicle_brand.strip()}%"))
    vehicle_model_rows = (
        model_q.group_by(VehicleModel.model)
        .order_by(func.count(func.distinct(ProductModel.id)).desc())
        .limit(limit)
        .all()
    )

    return CatalogFacetsResponse(
        brands=[CatalogFacetItem(value=r[0], count=int(r[1])) for r in brand_rows if r[0]],
        vehicle_brands=[
            CatalogFacetItem(value=r[0], count=int(r[1])) for r in vehicle_brand_rows if r[0]
        ],
        vehicle_models=[
            CatalogFacetItem(value=r[0], count=int(r[1])) for r in vehicle_model_rows if r[0]
        ],
    )
