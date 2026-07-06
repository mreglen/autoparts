"""Favorites and view history for authenticated buyers."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.models.product import Product as ProductModel
from app.models.user_engagement import UserFavorite, UserProductView
from app.schemas.product import ProductListItem
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


def list_favorites(db: Session, user_id: int) -> list[ProductListItem]:
    rows = (
        db.query(UserFavorite)
        .options(selectinload(UserFavorite.product).options(*_PRODUCT_LOAD))
        .filter(UserFavorite.user_id == user_id)
        .order_by(UserFavorite.created_at.desc())
        .all()
    )
    items: list[ProductListItem] = []
    for row in rows:
        product = row.product
        if not product:
            continue
        items.append(map_product_to_list_item(product, db=db))
    return items


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
