"""
Сервис для обработки закрытых заказов Авито.

При изменении статуса заказа на "closed" автоматически:
1. Создаёт запись в stock-out
2. Уменьшает количество товара
3. Удаляет товар из Avito и Drom xlsx номенклатуры
4. Удаляет связи listing
"""

from __future__ import annotations

import logging
from datetime import date
from pathlib import Path
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.stock_out import StockOut
from app.models.product_avito_listing_link import ProductAvitoListingLink
from app.models.product_drom_listing_link import ProductDromListingLink
from app.models.avito_orders_cache import AvitoOrderCache
from app.models.organization_avito_autoload_cache import OrganizationAvitoAutoloadCache
from app.models.organization_drom_autoload_cache import OrganizationDromAutoloadCache
from app.services.avito_autoload_xlsx import remove_product_from_avito_autoload
from app.services.drom_autoload_xlsx import remove_product_from_drom_autoload
from app.services.avito_orders_api import get_avito_order
from app.services.avito_order_pricing import (
    avito_line_item_qty,
    avito_order_items,
    unit_price_for_stock_out,
)
from app.services.avito_order_item_match import (
    avito_item_identifiers,
    resolve_product_id_from_avito_item,
)

logger = logging.getLogger(__name__)


async def process_closed_avito_order(
    db: Session,
    order: AvitoOrderCache,
    *,
    access_token: Optional[str] = None,
    avito_user_id: Optional[int] = None,
) -> dict[str, Any]:
    """
    Обработать закрытый заказ Авито.
    Идемпотентная функция - можно вызывать многократно.
    
    Args:
        db: Сессия базы данных
        order: Объект заказа Авито со статусом "closed"
    """
    # Проверяем, не был ли заказ уже обработан
    if order.closed_processed:
        logger.info(f"Avito order {order.id} already processed, skipping")
        return {"processed_count": 0, "skipped_count": 0, "skipped_reasons": ["already_processed"]}
    
    order_id = order.id
    organization_id = order.organization_id
    avito_order_id = order.avito_order_id
    
    logger.info(f"Processing closed Avito order {order_id} (avito_order_id={avito_order_id})")
    
    # Логируем статус заказа из БД
    logger.info(f"Order status: {order.avito_status_code}, closed_processed: {order.closed_processed}")
    
    # Извлекаем товары из заказа
    avito_data = order.avito_data or {}
    items = avito_order_items(avito_data)
    if not items and access_token and avito_user_id and avito_order_id:
        try:
            details = await get_avito_order(access_token, int(avito_user_id), int(avito_order_id))
            if isinstance(details, dict):
                detailed_order = details.get("order") if isinstance(details.get("order"), dict) else details
                detailed_items = detailed_order.get("items") or detailed_order.get("products") or []
                if detailed_items:
                    avito_data = detailed_order
                    order.avito_data = detailed_order
                    items = avito_order_items(avito_data)
                    logger.info("Loaded %s items from order details for avito_order_id=%s", len(items), avito_order_id)
        except Exception as exc:
            logger.warning("Failed to fetch order details for avito_order_id=%s: %s", avito_order_id, exc)
    
    logger.info(f"Found {len(items)} items in order {order_id}")
    
    if not items:
        logger.warning(f"No items found in Avito order {order_id}")
        return {"processed_count": 0, "skipped_count": 1, "skipped_reasons": ["no_items"]}
    
    # Логируем первый item для отладки
    if items:
        first_item = items[0] if isinstance(items, list) else items
        if isinstance(first_item, dict):
            logger.info(f"First item keys: {list(first_item.keys())}")
            logger.info(f"First item avitoId: {first_item.get('avitoId')}")
            logger.info(f"First item count: {first_item.get('count')}")
            logger.info(f"First item prices: {first_item.get('prices')}")
    
    processed_products = []
    skipped_reasons: list[str] = []
    
    for item in items:
        if not isinstance(item, dict):
            continue
        
        try:
            item_quantity = avito_line_item_qty(item)
            avito_item_id, internal_code = avito_item_identifiers(item)

            product_id = resolve_product_id_from_avito_item(db, organization_id, item)
            if not product_id:
                logger.warning(
                    f"ProductAvitoListingLink not found for order {order_id}. "
                    f"avitoId={avito_item_id}, internal_code={internal_code}, "
                    f"Item keys: {list(item.keys())}"
                )
                skipped_reasons.append("listing_not_found")
                continue

            listing_link = (
                db.query(ProductAvitoListingLink)
                .filter_by(organization_id=organization_id, product_id=product_id)
                .first()
            )

            product = listing_link.product if listing_link else None
            if not product:
                from app.models.product import Product

                product = db.query(Product).filter(Product.id == product_id).first()
            if not product:
                logger.warning(f"Product not found for product_id={product_id}")
                skipped_reasons.append("product_not_found")
                continue
            
            # Проверяем наличие товара
            if product.quantity < item_quantity:
                logger.error(
                    f"Insufficient quantity for product {product.id}: "
                    f"have {product.quantity}, need {item_quantity}"
                )
                skipped_reasons.append("insufficient_quantity")
                continue

            item_unit_price = unit_price_for_stock_out(
                item,
                product_price=float(product.price or 0),
            )
            if item_unit_price <= 0:
                logger.warning(
                    "Avito order %s item has no price in API and product %s has no price; "
                    "stock_out will have sale_price=0",
                    order_id,
                    product.id,
                )

            # Создаём запись StockOut
            stock_out = StockOut(
                organization_id=organization_id,
                product_id=product.id,
                acquired_product_id=None,
                storage_location_id=product.storage_location_id,
                user_id=None,  # Системная операция
                quantity=item_quantity,
                sale_price=item_unit_price,
                movement_date=date.today(),
                reason="Продано через Авито",
                sale_channel="avito",
                avito_order_id=avito_order_id,
            )
            db.add(stock_out)
            
            # Уменьшаем количество товара
            product.quantity -= item_quantity
            
            processed_products.append({
                "product_id": product.id,
                "internal_code": product.internal_code,
                "article": product.article,
                "avito_id": (listing_link.avito_id if listing_link else None) or avito_item_id,
                "quantity": item_quantity,
                "price": item_unit_price,
            })
            
            logger.info(
                f"Created StockOut for product {product.id}, "
                f"quantity={item_quantity}, unit_price={item_unit_price}"
            )
            
        except Exception as e:
            logger.error(f"Error processing item in order {order_id}: {e}", exc_info=True)
            skipped_reasons.append("item_processing_error")
            continue
    
    # Если были обработаны товары, удаляем их из xlsx и связей
    if processed_products:
        try:
            # Удаляем товары из Avito xlsx номенклатуры
            _remove_from_avito_xlsx(db, organization_id, processed_products)
            
            # Удаляем товары из Drom xlsx номенклатуры
            _remove_from_drom_xlsx(db, organization_id, processed_products)
            
            # Удаляем связи listing для всех обработанных товаров
            product_ids = [p["product_id"] for p in processed_products]
            _delete_listing_links(db, organization_id, product_ids)
            
            # Коммитим все изменения
            db.commit()
            
            logger.info(
                f"Successfully processed {len(processed_products)} products "
                f"from Avito order {order_id}"
            )
            
        except Exception as e:
            logger.error(
                f"Error committing changes for order {order_id}: {e}",
                exc_info=True
            )
            db.rollback()
            raise
    else:
        logger.warning("No products were processed for closed Avito order %s", order_id)

    return {
        "processed_count": len(processed_products),
        "skipped_count": len(skipped_reasons),
        "skipped_reasons": skipped_reasons,
    }


def _remove_from_avito_xlsx(
    db: Session,
    organization_id: str,
    processed_products: list[dict[str, Any]]
) -> None:
    """Удалить товары из Avito xlsx файла номенклатуры."""
    try:
        # Путь к файлу
        avito_dir = Path(__file__).resolve().parents[2] / "uploads" / "avito" / organization_id
        xlsx_path = avito_dir / "autoload.xlsx"
        
        if not xlsx_path.exists():
            logger.warning(f"Avito xlsx file not found: {xlsx_path}")
            return
        
        # Загружаем существующий файл
        existing_bytes = xlsx_path.read_bytes()
        
        # Удаляем каждый товар
        current_bytes = existing_bytes
        for product_info in processed_products:
            internal_code = product_info["internal_code"]
            avito_id = product_info.get("avito_id")
            try:
                current_bytes = remove_product_from_avito_autoload(
                    current_bytes,
                    internal_code,
                    avito_id=avito_id,
                )
                logger.info(f"Removed product {internal_code} from Avito xlsx")
            except Exception as e:
                logger.error(f"Error removing product {internal_code} from Avito xlsx: {e}")
        
        # Сохраняем обновлённый файл
        xlsx_path.write_bytes(current_bytes)
        
        # Обновляем кеш
        _update_avito_cache(db, organization_id, current_bytes)
        
    except Exception as e:
        logger.error(f"Error removing products from Avito xlsx: {e}", exc_info=True)


def _remove_from_drom_xlsx(
    db: Session,
    organization_id: str,
    processed_products: list[dict[str, Any]]
) -> None:
    """Удалить товары из Drom xlsx файла номенклатуры."""
    try:
        cache = db.query(OrganizationDromAutoloadCache).filter_by(organization_id=organization_id).first()
        xlsx_path = None
        if cache and cache.saved_path:
            candidate = Path(cache.saved_path)
            if candidate.is_file():
                xlsx_path = candidate

        if xlsx_path is None:
            drom_dir = Path(__file__).resolve().parents[2] / "uploads" / "drom" / organization_id
            export_path = drom_dir / "export.xlsx"
            autoload_path = drom_dir / "autoload.xlsx"
            xlsx_path = export_path if export_path.exists() else autoload_path
        
        if not xlsx_path.exists():
            logger.warning(f"Drom xlsx file not found: {xlsx_path}")
            return
        
        # Загружаем существующий файл
        existing_bytes = xlsx_path.read_bytes()
        
        # Удаляем каждый товар
        current_bytes = existing_bytes
        for product_info in processed_products:
            article = product_info["article"]
            if not article:
                continue
            try:
                current_bytes = remove_product_from_drom_autoload(
                    current_bytes,
                    article
                )
                logger.info(f"Removed product {article} from Drom xlsx")
            except Exception as e:
                logger.error(f"Error removing product {article} from Drom xlsx: {e}")
        
        # Сохраняем обновлённый файл
        xlsx_path.write_bytes(current_bytes)
        
        # Обновляем кеш
        _update_drom_cache(db, organization_id, current_bytes)
        
    except Exception as e:
        logger.error(f"Error removing products from Drom xlsx: {e}", exc_info=True)


def _delete_listing_links(
    db: Session,
    organization_id: str,
    product_ids: list[int]
) -> None:
    """Удалить связи listing для товаров."""
    try:
        # Удаляем Avito listing links
        avito_deleted = db.query(ProductAvitoListingLink).filter(
            ProductAvitoListingLink.organization_id == organization_id,
            ProductAvitoListingLink.product_id.in_(product_ids)
        ).delete(synchronize_session=False)
        
        # Удаляем Drom listing links
        drom_deleted = db.query(ProductDromListingLink).filter(
            ProductDromListingLink.organization_id == organization_id,
            ProductDromListingLink.product_id.in_(product_ids)
        ).delete(synchronize_session=False)
        
        logger.info(
            f"Deleted listing links: {avito_deleted} Avito, {drom_deleted} Drom"
        )
        
    except Exception as e:
        logger.error(f"Error deleting listing links: {e}", exc_info=True)


def _update_avito_cache(
    db: Session,
    organization_id: str,
    xlsx_bytes: bytes
) -> None:
    """Обновить кеш Avito autoload после изменения xlsx файла."""
    try:
        from app.services.avito_autoload_xlsx import parse_and_validate_avito_autoload
        
        cache = db.query(OrganizationAvitoAutoloadCache).filter_by(
            organization_id=organization_id
        ).first()
        
        if not cache:
            return
        
        # Парсим обновлённый файл
        parsed = parse_and_validate_avito_autoload(xlsx_bytes)
        
        # Обновляем кеш
        import json
        cache.items_json = json.dumps(parsed.items, ensure_ascii=False)
        cache.local_validation_ok = parsed.local_ok
        cache.local_errors_json = json.dumps(parsed.local_errors, ensure_ascii=False)
        cache.sheets_parsed_json = json.dumps(parsed.sheets_parsed, ensure_ascii=False)
        
        logger.info(f"Updated Avito autoload cache for org {organization_id}")
        
    except Exception as e:
        logger.error(f"Error updating Avito cache: {e}", exc_info=True)


def _update_drom_cache(
    db: Session,
    organization_id: str,
    xlsx_bytes: bytes
) -> None:
    """Обновить кеш Drom autoload после изменения xlsx файла."""
    try:
        from app.services.drom_autoload_xlsx import parse_and_validate_drom_autoload
        
        cache = db.query(OrganizationDromAutoloadCache).filter_by(
            organization_id=organization_id
        ).first()
        
        if not cache:
            return
        
        # Парсим обновлённый файл
        parsed = parse_and_validate_drom_autoload(xlsx_bytes)
        
        # Обновляем кеш
        import json
        cache.items_json = json.dumps(parsed.items, ensure_ascii=False)
        cache.local_validation_ok = parsed.local_ok
        cache.local_errors_json = json.dumps(parsed.local_errors, ensure_ascii=False)
        
        logger.info(f"Updated Drom autoload cache for org {organization_id}")
        
    except Exception as e:
        logger.error(f"Error updating Drom cache: {e}", exc_info=True)
