"""Favorites and view history for authenticated buyers."""
from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.models.product import Product as ProductModel
from app.models.user_engagement import UserFavorite, UserProductView, UserRosskoFavorite
from app.schemas.product import ProductListItem
from app.schemas.user_engagement import FavoriteListItem, RosskoFavoriteCreateIn
from app.utils.product_list_item import map_product_to_list_item

VIEW_HISTORY_LIMIT = 50

_PRODUCT_LOAD = (
    selectinload(ProductModel.photos),
    selectinload(ProductModel.organization),
    selectinload(ProductModel.storage_location),
)


def _load_product(db: Session, product_id: int) -> ProductModel | None:
    return (
        db.query(ProductModel)
        .options(*_PRODUCT_LOAD)
        .filter(ProductModel.id == product_id)
        .first()
    )


def _ensure_product(db: Session, product_id: int) -> ProductModel:
    product = _load_product(db, product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Товар не найден",
        )
    return product


def _normalize_rossko_part(brand: str, partnumber: str) -> tuple[str, str]:
    return brand.strip().upper(), partnumber.strip().upper()


def _rossko_snapshot_json(min_price: float | None) -> str | None:
    if min_price is None:
        return None
    return json.dumps({"min_price": float(min_price)}, ensure_ascii=False)


def _rossko_price_from_snapshot(snapshot_json: str | None) -> float:
    if not snapshot_json:
        return 0.0
    try:
        data = json.loads(snapshot_json)
        return float(data.get("min_price") or 0)
    except (TypeError, ValueError, json.JSONDecodeError):
        return 0.0


def _product_item_to_favorite(item: ProductListItem, favorite_created_at: datetime) -> FavoriteListItem:
    return FavoriteListItem(
        kind="product",
        id=item.id,
        brand=item.brand,
        article=item.article,
        name=item.name,
        price=item.price,
        quantity=item.quantity,
        is_new=item.is_new,
        is_rossko=False,
        organization_id=item.organization_id,
        storage_location_id=item.storage_location_id,
        created_at=item.created_at,
        list_photo_url=item.list_photo_url,
        photos=item.photos,
        organization=item.organization,
        storage_location=item.storage_location,
        favorite_created_at=favorite_created_at,
    )


def _rossko_row_to_favorite(row: UserRosskoFavorite) -> FavoriteListItem:
    title = (row.title or "").strip() or f"{row.brand} {row.partnumber}".strip()
    return FavoriteListItem(
        kind="rossko",
        id=0,
        brand=row.brand,
        article=row.partnumber,
        name=title,
        price=_rossko_price_from_snapshot(row.snapshot_json),
        quantity=0,
        is_new=True,
        is_rossko=True,
        rossko_guid=row.rossko_guid,
        organization_id="",
        storage_location_id=0,
        photos=[],
        favorite_created_at=row.created_at,
    )


def is_favorite(db: Session, user_id: int, product_id: int) -> bool:
    return (
        db.query(UserFavorite.id)
        .filter(
            UserFavorite.user_id == user_id,
            UserFavorite.product_id == product_id,
        )
        .first()
        is not None
    )


def is_rossko_favorite(db: Session, user_id: int, brand: str, partnumber: str) -> bool:
    brand_key, part_key = _normalize_rossko_part(brand, partnumber)
    return (
        db.query(UserRosskoFavorite.id)
        .filter(
            UserRosskoFavorite.user_id == user_id,
            UserRosskoFavorite.brand_normalized == brand_key,
            UserRosskoFavorite.partnumber_normalized == part_key,
        )
        .first()
        is not None
    )


def add_favorite(db: Session, user_id: int, product_id: int) -> None:
    _ensure_product(db, product_id)
    existing = (
        db.query(UserFavorite)
        .filter(
            UserFavorite.user_id == user_id,
            UserFavorite.product_id == product_id,
        )
        .first()
    )
    if existing:
        return
    db.add(UserFavorite(user_id=user_id, product_id=product_id))
    db.commit()


def add_rossko_favorite(db: Session, user_id: int, payload: RosskoFavoriteCreateIn) -> None:
    brand = payload.brand.strip()
    partnumber = payload.partnumber.strip()
    if not brand or not partnumber:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Укажите бренд и артикул",
        )
    brand_key, part_key = _normalize_rossko_part(brand, partnumber)
    existing = (
        db.query(UserRosskoFavorite)
        .filter(
            UserRosskoFavorite.user_id == user_id,
            UserRosskoFavorite.brand_normalized == brand_key,
            UserRosskoFavorite.partnumber_normalized == part_key,
        )
        .first()
    )
    if existing:
        return
    db.add(
        UserRosskoFavorite(
            user_id=user_id,
            rossko_guid=(payload.guid or "").strip() or None,
            brand=brand,
            partnumber=partnumber,
            brand_normalized=brand_key,
            partnumber_normalized=part_key,
            title=(payload.title or "").strip() or None,
            snapshot_json=_rossko_snapshot_json(payload.min_price),
        )
    )
    db.commit()


def remove_favorite(db: Session, user_id: int, product_id: int) -> None:
    row = (
        db.query(UserFavorite)
        .filter(
            UserFavorite.user_id == user_id,
            UserFavorite.product_id == product_id,
        )
        .first()
    )
    if row:
        db.delete(row)
        db.commit()


def remove_rossko_favorite(db: Session, user_id: int, brand: str, partnumber: str) -> None:
    brand_key, part_key = _normalize_rossko_part(brand, partnumber)
    row = (
        db.query(UserRosskoFavorite)
        .filter(
            UserRosskoFavorite.user_id == user_id,
            UserRosskoFavorite.brand_normalized == brand_key,
            UserRosskoFavorite.partnumber_normalized == part_key,
        )
        .first()
    )
    if row:
        db.delete(row)
        db.commit()


def list_favorites(db: Session, user_id: int) -> list[FavoriteListItem]:
    product_rows = (
        db.query(UserFavorite)
        .options(selectinload(UserFavorite.product).options(*_PRODUCT_LOAD))
        .filter(UserFavorite.user_id == user_id)
        .all()
    )
    rossko_rows = (
        db.query(UserRosskoFavorite)
        .filter(UserRosskoFavorite.user_id == user_id)
        .all()
    )

    merged: list[FavoriteListItem] = []
    for row in product_rows:
        product = row.product
        if not product:
            continue
        product_item = map_product_to_list_item(product, db=db)
        merged.append(_product_item_to_favorite(product_item, row.created_at))

    for row in rossko_rows:
        merged.append(_rossko_row_to_favorite(row))

    merged.sort(
        key=lambda item: item.favorite_created_at or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    return merged


def record_product_view(db: Session, user_id: int, product_id: int) -> None:
    _ensure_product(db, product_id)
    now = datetime.now(timezone.utc)
    row = (
        db.query(UserProductView)
        .filter(
            UserProductView.user_id == user_id,
            UserProductView.product_id == product_id,
        )
        .first()
    )
    if row:
        row.viewed_at = now
    else:
        db.add(UserProductView(user_id=user_id, product_id=product_id, viewed_at=now))
    db.commit()
    _trim_view_history(db, user_id)


def _trim_view_history(db: Session, user_id: int) -> None:
    keep_ids = [
        row.id
        for row in (
            db.query(UserProductView.id)
            .filter(UserProductView.user_id == user_id)
            .order_by(UserProductView.viewed_at.desc())
            .limit(VIEW_HISTORY_LIMIT)
            .all()
        )
    ]
    if not keep_ids:
        return
    (
        db.query(UserProductView)
        .filter(
            UserProductView.user_id == user_id,
            UserProductView.id.notin_(keep_ids),
        )
        .delete(synchronize_session=False)
    )
    db.commit()


def list_view_history(db: Session, user_id: int) -> list[ProductListItem]:
    rows = (
        db.query(UserProductView)
        .options(selectinload(UserProductView.product).options(*_PRODUCT_LOAD))
        .filter(UserProductView.user_id == user_id)
        .order_by(UserProductView.viewed_at.desc())
        .limit(VIEW_HISTORY_LIMIT)
        .all()
    )
    items: list[ProductListItem] = []
    for row in rows:
        product = row.product
        if not product:
            continue
        items.append(map_product_to_list_item(product, db=db))
    return items


def clear_view_history(db: Session, user_id: int) -> None:
    db.query(UserProductView).filter(UserProductView.user_id == user_id).delete(
        synchronize_session=False
    )
    db.commit()
