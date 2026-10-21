"""Сверка XLSX прайс-листа Drom с остатками на складе.

Файл `uploads/drom/<org_id>/export.xlsx` заполняется upsert'ом по артикулу,
поэтому позиции, выписанные через /stock-out, оставались в прайсе с прежним
количеством. Здесь они убираются, а вернувшиеся на склад — возвращаются.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models.organization import Organization
from app.models.organization_drom_autoload_cache import OrganizationDromAutoloadCache
from app.models.organization_drom_integration import OrganizationDromIntegration
from app.models.product import Product
from app.models.product_drom_listing_link import ProductDromListingLink
from app.models.storage_location import StorageLocation
from app.services.drom_api import sync_price_list_chunks_sync
from app.services.drom_autoload_xlsx import (
    chunk_export_rows_for_drom_sync,
    parse_and_validate_drom_autoload,
    remove_products_from_drom_autoload,
    upsert_products_to_drom_autoload,
    zero_quantity_rows_for_articles,
)
from app.services.marketplace_site_footer import append_marketplace_site_info
from app.utils.avito_crypto import decrypt_secret

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DROM_UPLOADS_DIR = PROJECT_ROOT / "uploads" / "drom"
PRICE_LIST_FILE = "export.xlsx"


def _public_base_url() -> str:
    return (settings.PUBLIC_BASE_URL or settings.BASE_URL or "").strip()


def _as_number(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _article_of(product: Product) -> str:
    return str(product.article or "").strip()


def _quantity_of(product: Product) -> int:
    return int(product.quantity or 0)


def price_list_candidates(org_id: str) -> list[Path]:
    return [
        DROM_UPLOADS_DIR / org_id / PRICE_LIST_FILE,
        DROM_UPLOADS_DIR / org_id / "autoload.xlsx",
    ]


def resolve_price_list_file(db: Session, org_id: str) -> Optional[Path]:
    """Тот же порядок поиска файла, что в endpoints автозагрузки Drom."""
    cache = (
        db.query(OrganizationDromAutoloadCache)
        .filter(OrganizationDromAutoloadCache.organization_id == org_id)
        .first()
    )
    if cache and cache.saved_path:
        candidate = Path(cache.saved_path)
        if not candidate.is_absolute():
            candidate = PROJECT_ROOT / cache.saved_path.lstrip("/")
        if candidate.is_file():
            return candidate
    for candidate in price_list_candidates(org_id):
        if candidate.is_file():
            return candidate
    return None


def _export_row(org: Optional[Organization], product: Product,
                storage_by_id: dict[int, StorageLocation]) -> dict[str, Any]:
    photos = [ph.photo_url for ph in (product.photos or []) if ph.photo_url]
    storage = storage_by_id.get(product.storage_location_id) if product.storage_location_id else None
    address = (storage.address if storage and storage.address else None) or (org.address if org else "") or ""
    return {
        "product_id": product.id,
        "article": _article_of(product),
        "name": product.name or "",
        "is_new": bool(product.is_new),
        "brand": product.brand or "",
        "price": product.price or 0,
        "quantity": _quantity_of(product),
        "photos": photos[:5],
        "storage_address": address,
        "note": append_marketplace_site_info(
            product.description or "",
            enabled=bool(getattr(org, "append_marketplace_site_info", False)) if org else False,
            product=product,
            site_origin=_public_base_url(),
        ),
    }


def _sync_removed_articles(db: Session, org_id: str, articles: list[str]) -> Optional[dict[str, Any]]:
    """Снять позиции с площадки количеством 0 — только при включённой автосинхронизации."""
    if not articles:
        return None
    integration = (
        db.query(OrganizationDromIntegration)
        .filter(OrganizationDromIntegration.organization_id == org_id)
        .first()
    )
    if not (
        integration
        and integration.is_enabled
        and integration.auto_sync_enabled
        and integration.packet_id
        and integration.api_key_encrypted
    ):
        return None
    try:
        result = sync_price_list_chunks_sync(
            packet_id=integration.packet_id,
            api_key=decrypt_secret(integration.api_key_encrypted),
            chunks=chunk_export_rows_for_drom_sync(zero_quantity_rows_for_articles(articles)),
        )
        integration.last_sync_at = datetime.now(timezone.utc).replace(tzinfo=None)
        integration.last_sync_status = result.status_code
        integration.last_sync_error = None if result.ok else (result.error_message or result.error_code)
        db.commit()
        return {"ok": result.ok, "status": result.status_code}
    except Exception as e:
        logger.error("Drom qty=0 sync failed for org %s: %s", org_id, e, exc_info=True)
        return {"ok": False, "error": str(e)}


def _refresh_cache(db: Session, org_id: str, xlsx_bytes: bytes) -> None:
    cache = (
        db.query(OrganizationDromAutoloadCache)
        .filter(OrganizationDromAutoloadCache.organization_id == org_id)
        .first()
    )
    if not cache:
        return
    parsed = parse_and_validate_drom_autoload(xlsx_bytes)
    cache.items_json = json.dumps(parsed.items, ensure_ascii=False)
    cache.local_validation_ok = parsed.local_ok
    cache.local_errors_json = json.dumps(parsed.local_errors, ensure_ascii=False)
    db.commit()


def _stock_by_article(products: list[Product]) -> tuple[dict[str, Product], set[str]]:
    """Артикул в наличии, если хоть одна позиция с ним имеет остаток > 0."""
    in_stock: dict[str, Product] = {}
    out_of_stock: set[str] = set()
    for product in products:
        article = _article_of(product)
        if not article:
            continue
        if _quantity_of(product) > 0:
            current = in_stock.get(article)
            if current is None or _quantity_of(current) < _quantity_of(product):
                in_stock[article] = product
        else:
            out_of_stock.add(article)
    return in_stock, out_of_stock - set(in_stock)


def reconcile_drom_price_list(db: Session, org_id: str) -> dict[str, Any]:
    path = resolve_price_list_file(db, org_id)
    if not path:
        return {"organization_id": org_id, "skipped": "нет файла прайс-листа"}

    original_bytes = path.read_bytes()
    parsed = parse_and_validate_drom_autoload(original_bytes)
    file_articles = sorted({
        str(item.get("article") or "").strip()
        for item in parsed.items
        if str(item.get("article") or "").strip()
    })
    if not file_articles:
        return {"organization_id": org_id, "rows": 0, "removed": 0, "refreshed": 0}

    org = db.query(Organization).filter(Organization.id == org_id).first()
    file_products = (
        db.query(Product)
        .options(selectinload(Product.photos))
        .filter(Product.organization_id == org_id, Product.article.in_(file_articles))
        .all()
    )
    in_stock, out_of_stock = _stock_by_article(file_products)
    stale = [article for article in file_articles if article in out_of_stock]

    if stale and len(stale) == len(file_articles):
        logger.warning(
            "Drom reconcile org %s: все %s строк без остатка — файл не изменён",
            org_id, len(stale),
        )
        return {
            "organization_id": org_id,
            "rows": len(file_articles),
            "removed": 0,
            "refreshed": 0,
            "skipped": "все позиции выписаны — файл не изменён",
        }

    new_bytes = remove_products_from_drom_autoload(original_bytes, stale) if stale else original_bytes

    storage_ids = {p.storage_location_id for p in in_stock.values() if p.storage_location_id}
    storage_by_id = {
        row.id: row
        for row in (
            db.query(StorageLocation).filter(StorageLocation.id.in_(list(storage_ids))).all()
            if storage_ids
            else []
        )
    }
    items_by_article = {str(item.get("article") or "").strip(): item for item in parsed.items}
    linked_products = (
        db.query(Product)
        .options(selectinload(Product.photos))
        .join(ProductDromListingLink, ProductDromListingLink.product_id == Product.id)
        .filter(
            ProductDromListingLink.organization_id == org_id,
            Product.organization_id == org_id,
            Product.quantity > 0,
        )
        .all()
    )
    rows = []
    for product in linked_products:
        article = _article_of(product)
        if not article:
            continue
        row = items_by_article.get(article)
        if row is not None and article not in out_of_stock:
            if _as_number(row.get("quantity")) == _quantity_of(product) and _as_number(row.get("price")) == _as_number(product.price):
                continue
        rows.append(_export_row(org, product, storage_by_id))

    if rows:
        new_bytes = upsert_products_to_drom_autoload(new_bytes, rows, _public_base_url())

    if new_bytes != original_bytes:
        path.write_bytes(new_bytes)
        _refresh_cache(db, org_id, new_bytes)

    known = set(in_stock) | out_of_stock
    return {
        "organization_id": org_id,
        "file": str(path.relative_to(PROJECT_ROOT)),
        "rows": len(file_articles),
        "removed": len(stale),
        "removed_articles": stale,
        "refreshed": len(rows),
        "unknown_rows": len([article for article in file_articles if article not in known]),
        "sync": _sync_removed_articles(db, org_id, stale),
    }


def reconcile_all_drom_price_lists(db: Session) -> dict[str, Any]:
    if not DROM_UPLOADS_DIR.is_dir():
        return {"organizations": 0, "removed": 0, "refreshed": 0, "details": []}

    org_ids = sorted(
        child.name for child in DROM_UPLOADS_DIR.iterdir()
        if child.is_dir() and any(candidate.is_file() for candidate in price_list_candidates(child.name))
    )
    details = []
    for org_id in org_ids:
        try:
            details.append(reconcile_drom_price_list(db, org_id))
        except Exception as e:
            db.rollback()
            logger.error("Drom price list reconcile failed for org %s: %s", org_id, e, exc_info=True)
            details.append({"organization_id": org_id, "error": str(e)})

    return {
        "organizations": len(org_ids),
        "removed": sum(int(item.get("removed") or 0) for item in details),
        "refreshed": sum(int(item.get("refreshed") or 0) for item in details),
        "details": details,
    }
