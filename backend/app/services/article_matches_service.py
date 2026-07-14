"""Поиск совпадений артикула среди товаров организации (products + pending)."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Literal

from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.pending_product import PendingProduct
from app.models.pending_product_storage_cell import PendingProductStorageCell
from app.models.product import Product, ProductPhoto, ProductVideo
from app.models.product_storage_cell import ProductStorageCell
from app.schemas.article_matches import (
    ArticleMatchDetailResponse,
    ArticleMatchListItem,
    ArticleMatchMediaOut,
    ArticleMatchesResponse,
    ArticleMatchStorageCellOut,
)
from app.utils.partnumber import normalize_partnumber
from app.utils.search_sql import get_sql_normalize
from app.utils.user_display_name import format_user_full_name


def _photo_url_from_product(product: Product) -> str | None:
    photos = list(product.photos or [])
    if not photos:
        return None
    first = photos[0]
    url = (getattr(first, "thumb_url", None) or getattr(first, "photo_url", None) or "").strip()
    return url or None


def _photo_url_from_pending(pending: PendingProduct) -> str | None:
    raw = pending.photos
    if not raw:
        return None
    try:
        photos = json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        return None
    if not isinstance(photos, list) or not photos:
        return None
    first = photos[0]
    if isinstance(first, str) and first.strip():
        return first.strip()
    if isinstance(first, dict):
        url = (first.get("url") or first.get("photo_url") or "").strip()
        return url or None
    return None


def _parse_pending_media_list(raw: Any) -> list[str]:
    if not raw:
        return []
    try:
        data = json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        return []
    if not isinstance(data, list):
        return []
    out: list[str] = []
    for item in data:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
        elif isinstance(item, dict):
            url = (item.get("url") or item.get("photo_url") or item.get("video_url") or "").strip()
            if url:
                out.append(url)
    return out


def _epoch(dt: datetime | None, fallback_id: int) -> float:
    if dt is None:
        return float(fallback_id)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()


def find_article_matches(
    db: Session,
    *,
    organization_id: str,
    q: str,
    sort: Literal["date", "quantity"] = "date",
    offset: int = 0,
    limit: int = 20,
) -> ArticleMatchesResponse:
    norm_q = normalize_partnumber(q)
    if len(norm_q) < 2:
        return ArticleMatchesResponse(items=[], total=0, has_more=False, offset=offset, limit=limit)

    product_norm = get_sql_normalize(Product.article)
    pending_norm = get_sql_normalize(PendingProduct.article)

    products = (
        db.query(Product)
        .options(
            selectinload(Product.photos),
            joinedload(Product.creator),
        )
        .filter(
            Product.organization_id == organization_id,
            product_norm.contains(norm_q),
        )
        .all()
    )

    pendings = (
        db.query(PendingProduct)
        .options(joinedload(PendingProduct.creator))
        .filter(
            PendingProduct.organization_id == organization_id,
            pending_norm.contains(norm_q),
        )
        .all()
    )

    items: list[ArticleMatchListItem] = []

    for product in products:
        article = str(product.article or "")
        is_exact = normalize_partnumber(article) == norm_q
        items.append(
            ArticleMatchListItem(
                id=product.id,
                source="product",
                article=article,
                brand=str(product.brand or ""),
                name=str(product.name or ""),
                quantity=int(product.quantity or 0),
                price=float(product.price) if product.price is not None else None,
                photo_url=_photo_url_from_product(product),
                created_at=None,
                created_by=product.created_by,
                creator_full_name=format_user_full_name(product.creator),
                is_exact=is_exact,
            )
        )

    for pending in pendings:
        article = str(pending.article or "")
        is_exact = normalize_partnumber(article) == norm_q
        items.append(
            ArticleMatchListItem(
                id=pending.id,
                source="pending",
                article=article,
                brand=str(pending.brand or ""),
                name=str(pending.name or ""),
                quantity=int(pending.quantity or 0),
                price=float(pending.price) if pending.price is not None else None,
                photo_url=_photo_url_from_pending(pending),
                created_at=pending.created_at,
                created_by=pending.created_by,
                creator_full_name=format_user_full_name(pending.creator),
                is_exact=is_exact,
            )
        )

    if sort == "quantity":
        items.sort(
            key=lambda row: (
                0 if row.is_exact else 1,
                -int(row.quantity or 0),
                -_epoch(row.created_at, row.id),
            )
        )
    else:
        items.sort(
            key=lambda row: (
                0 if row.is_exact else 1,
                -_epoch(row.created_at, row.id),
                -int(row.quantity or 0),
            )
        )

    total = len(items)
    page = items[offset : offset + limit]
    return ArticleMatchesResponse(
        items=page,
        total=total,
        has_more=offset + limit < total,
        offset=offset,
        limit=limit,
    )


def get_article_match_detail(
    db: Session,
    *,
    organization_id: str,
    source: Literal["product", "pending"],
    item_id: int,
) -> ArticleMatchDetailResponse | None:
    if source == "product":
        product = (
            db.query(Product)
            .options(
                selectinload(Product.photos),
                selectinload(Product.videos),
                joinedload(Product.creator),
                joinedload(Product.storage_location),
                selectinload(Product.product_storage_cells).selectinload(ProductStorageCell.storage_cell),
            )
            .filter(Product.id == item_id, Product.organization_id == organization_id)
            .first()
        )
        if not product:
            return None

        photos = [
            str(getattr(p, "photo_url", "") or "").strip()
            for p in (product.photos or [])
            if str(getattr(p, "photo_url", "") or "").strip()
        ]
        videos = [
            str(getattr(v, "video_url", "") or "").strip()
            for v in (product.videos or [])
            if str(getattr(v, "video_url", "") or "").strip()
        ]
        media: list[ArticleMatchMediaOut] = [
            *[ArticleMatchMediaOut(url=u, kind="photo") for u in photos],
            *[ArticleMatchMediaOut(url=u, kind="video") for u in videos],
        ]
        cells: list[ArticleMatchStorageCellOut] = []
        for link in product.product_storage_cells or []:
            cell = link.storage_cell
            cells.append(
                ArticleMatchStorageCellOut(
                    id=link.id,
                    storage_cell_id=link.storage_cell_id,
                    value=link.value,
                    cell_name=getattr(cell, "name", None) if cell else None,
                )
            )

        loc = product.storage_location
        return ArticleMatchDetailResponse(
            id=product.id,
            source="product",
            article=str(product.article or ""),
            brand=str(product.brand or ""),
            name=str(product.name or ""),
            description=product.description,
            quantity=int(product.quantity or 0),
            price=float(product.price) if product.price is not None else None,
            is_new=bool(product.is_new),
            storage_location_id=product.storage_location_id,
            storage_location_address=getattr(loc, "address", None) if loc else None,
            part_type_id=product.part_type_id,
            created_by=product.created_by,
            creator_full_name=format_user_full_name(product.creator),
            created_at=None,
            media=media,
            storage_cells=cells,
            photos=photos,
            videos=videos,
        )

    pending = (
        db.query(PendingProduct)
        .options(
            joinedload(PendingProduct.creator),
            joinedload(PendingProduct.storage_location),
            selectinload(PendingProduct.pending_product_storage_cells).selectinload(
                PendingProductStorageCell.storage_cell
            ),
        )
        .filter(PendingProduct.id == item_id, PendingProduct.organization_id == organization_id)
        .first()
    )
    if not pending:
        return None

    photos = _parse_pending_media_list(pending.photos)
    videos = _parse_pending_media_list(pending.videos)
    media = [
        *[ArticleMatchMediaOut(url=u, kind="photo") for u in photos],
        *[ArticleMatchMediaOut(url=u, kind="video") for u in videos],
    ]
    cells = []
    for link in pending.pending_product_storage_cells or []:
        cell = link.storage_cell
        cells.append(
            ArticleMatchStorageCellOut(
                id=link.id,
                storage_cell_id=link.storage_cell_id,
                value=link.value,
                cell_name=getattr(cell, "name", None) if cell else None,
            )
        )
    loc = pending.storage_location
    return ArticleMatchDetailResponse(
        id=pending.id,
        source="pending",
        article=str(pending.article or ""),
        brand=str(pending.brand or ""),
        name=str(pending.name or ""),
        description=pending.description,
        quantity=int(pending.quantity or 0),
        price=float(pending.price) if pending.price is not None else None,
        is_new=bool(pending.is_new),
        storage_location_id=pending.storage_location_id,
        storage_location_address=getattr(loc, "address", None) if loc else None,
        part_type_id=pending.part_type_id,
        created_by=pending.created_by,
        creator_full_name=format_user_full_name(pending.creator),
        created_at=pending.created_at,
        media=media,
        storage_cells=cells,
        photos=photos,
        videos=videos,
    )
