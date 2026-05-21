"""
Сервис для обработки закрытых заказов Авито.

При статусе closed:
1. Создаёт запись в stock-out (через fulfill_stock_out, идемпотентно по позиции)
2. Уменьшает количество товара
3. Удаляет товар из Avito и Drom xlsx номенклатуры (только для новых списаний)
4. Удаляет связи listing
"""

from __future__ import annotations

import logging
from datetime import date
from pathlib import Path
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.product_avito_listing_link import ProductAvitoListingLink
from app.models.product_drom_listing_link import ProductDromListingLink
from app.models.avito_orders_cache import AvitoOrderCache
from app.models.organization_avito_autoload_cache import OrganizationAvitoAutoloadCache
from app.models.organization_drom_autoload_cache import OrganizationDromAutoloadCache
from app.models.stock_out import StockOut
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
from app.services.avito_warehouse_fulfillment import (
    make_skip_reason,
    update_fulfillment_fields,
)
from app.services.stock_sale_fulfillment import (
    FulfillStockOutRequest,
    StockOutSourceKind,
    fulfill_stock_out,
)

logger = logging.getLogger(__name__)


def _existing_avito_stock_out(
    db: Session,
    organization_id: str,
    avito_order_id: str,
    product_id: int,
) -> Optional[StockOut]:
    return (
        db.query(StockOut)
        .filter(
            StockOut.organization_id == organization_id,
            StockOut.product_id == product_id,
            StockOut.avito_order_id == str(avito_order_id),
        )
        .first()
    )


async def process_closed_avito_order(
    db: Session,
    order: AvitoOrderCache,
    *,
    access_token: Optional[str] = None,
    avito_user_id: Optional[int] = None,
) -> dict[str, Any]:
    """
    Обработать закрытый заказ Авито.
    Идемпотентна по позициям — повторный вызов не дублирует stock_out.
    """
    order_id = order.id
    organization_id = order.organization_id
    avito_order_id = order.avito_order_id

    logger.info(
        "Processing closed Avito order %s (avito_order_id=%s, status=%s, fulfillment=%s)",
        order_id,
        avito_order_id,
        order.avito_status_code,
        order.stock_fulfillment_status,
    )

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
                    logger.info(
                        "Loaded %s items from order details for avito_order_id=%s",
                        len(items),
                        avito_order_id,
                    )
        except Exception as exc:
            logger.warning(
                "Failed to fetch order details for avito_order_id=%s: %s",
                avito_order_id,
                exc,
            )

    skipped_reasons: list[dict[str, Any]] = []
    processed_products: list[dict[str, Any]] = []
    reused_count = 0
    created_count = 0

    if not items:
        logger.warning("No items found in Avito order %s", order_id)
        skipped_reasons.append(make_skip_reason("no_items", message="Позиции заказа не найдены"))
        result = {
            "processed_count": 0,
            "reused_count": 0,
            "created_count": 0,
            "skipped_count": len(skipped_reasons),
            "skipped_reasons": skipped_reasons,
        }
        update_fulfillment_fields(order, result, db=db)
        db.commit()
        return result

    for item in items:
        if not isinstance(item, dict):
            continue

        avito_item_id, internal_code = avito_item_identifiers(item)

        try:
            item_quantity = avito_line_item_qty(item)
            product_id = resolve_product_id_from_avito_item(db, organization_id, item)
            if not product_id:
                logger.warning(
                    "ProductAvitoListingLink not found for order %s. avitoId=%s internal_code=%s",
                    order_id,
                    avito_item_id,
                    internal_code,
                )
                skipped_reasons.append(
                    make_skip_reason(
                        "listing_not_found",
                        avito_item_id=avito_item_id,
                        message="Не найдена привязка объявления к товару",
                    )
                )
                continue

            existing = _existing_avito_stock_out(
                db, organization_id, str(avito_order_id), product_id
            )
            if existing:
                reused_count += 1
                processed_products.append(
                    {
                        "product_id": product_id,
                        "quantity": item_quantity,
                        "reused": True,
                        "stock_out_id": existing.id,
                    }
                )
                logger.info(
                    "Reused existing StockOut id=%s for product %s order %s",
                    existing.id,
                    product_id,
                    order_id,
                )
                continue

            listing_link = (
                db.query(ProductAvitoListingLink)
                .filter_by(organization_id=organization_id, product_id=product_id)
                .first()
            )

            product = listing_link.product if listing_link else None
            if not product:
                product = db.query(Product).filter(Product.id == product_id).first()
            if not product:
                skipped_reasons.append(
                    make_skip_reason(
                        "product_not_found",
                        product_id=product_id,
                        avito_item_id=avito_item_id,
                    )
                )
                continue

            if product.storage_location_id is None:
                skipped_reasons.append(
                    make_skip_reason(
                        "missing_storage_location",
                        product_id=product.id,
                        avito_item_id=avito_item_id,
                        message="Укажите ячейку склада у товара",
                    )
                )
                continue

            item_unit_price = unit_price_for_stock_out(
                item,
                product_price=float(product.price or 0),
            )
            if item_unit_price <= 0:
                logger.warning(
                    "Avito order %s item skipped: zero price (product %s)",
                    order_id,
                    product.id,
                )
                skipped_reasons.append(
                    make_skip_reason(
                        "zero_price",
                        product_id=product.id,
                        avito_item_id=avito_item_id,
                        message="Запустите пересчёт цен или укажите цену в карточке",
                    )
                )
                continue

            fulfill_result = fulfill_stock_out(
                db,
                FulfillStockOutRequest(
                    organization_id=organization_id,
                    product_id=product.id,
                    acquired_product_id=None,
                    storage_location_id=product.storage_location_id,
                    user_id=None,
                    quantity=item_quantity,
                    sale_price=item_unit_price,
                    movement_date=date.today(),
                    reason="Продано через Авито",
                    sale_channel="avito",
                    avito_order_id=avito_order_id,
                    source_kind=StockOutSourceKind.AVITO,
                ),
                commit=False,
            )

            if fulfill_result.created:
                created_count += 1
            else:
                reused_count += 1

            processed_products.append(
                {
                    "product_id": product.id,
                    "internal_code": product.internal_code,
                    "article": product.article,
                    "avito_id": (listing_link.avito_id if listing_link else None) or avito_item_id,
                    "quantity": item_quantity,
                    "price": item_unit_price,
                    "reused": not fulfill_result.created,
                    "stock_out_id": fulfill_result.stock_out.id,
                }
            )

            logger.info(
                "%s StockOut for product %s, quantity=%s, unit_price=%s",
                "Created" if fulfill_result.created else "Reused",
                product.id,
                item_quantity,
                item_unit_price,
            )

        except HTTPException as e:
            code = "insufficient_quantity" if e.status_code == 400 else "stock_out_error"
            logger.error(
                "Failed to create StockOut for Avito order %s product: %s",
                order_id,
                e.detail,
            )
            skipped_reasons.append(
                make_skip_reason(
                    code,
                    avito_item_id=avito_item_id,
                    message=str(e.detail) if e.detail else None,
                )
            )
            continue
        except Exception as e:
            logger.error("Error processing item in order %s: %s", order_id, e, exc_info=True)
            skipped_reasons.append(
                make_skip_reason(
                    "item_processing_error",
                    avito_item_id=avito_item_id,
                    message=str(e),
                )
            )
            continue

    newly_created = [p for p in processed_products if not p.get("reused")]

    if newly_created:
        try:
            _remove_from_avito_xlsx(db, organization_id, newly_created)
            _remove_from_drom_xlsx(db, organization_id, newly_created)
            product_ids = [p["product_id"] for p in newly_created]
            _delete_listing_links(db, organization_id, product_ids)
            db.commit()
            logger.info(
                "Successfully processed %s new product lines from Avito order %s",
                len(newly_created),
                order_id,
            )
        except Exception as e:
            logger.error("Error committing changes for order %s: %s", order_id, e, exc_info=True)
            db.rollback()
            raise
    elif processed_products or skipped_reasons:
        result_pre = {
            "processed_count": len(processed_products),
            "reused_count": reused_count,
            "created_count": created_count,
            "skipped_count": len(skipped_reasons),
            "skipped_reasons": skipped_reasons,
        }
        update_fulfillment_fields(order, result_pre, db=db)
        db.commit()
    else:
        logger.warning("No products were processed for closed Avito order %s", order_id)

    result = {
        "processed_count": len(processed_products),
        "reused_count": reused_count,
        "created_count": created_count,
        "skipped_count": len(skipped_reasons),
        "skipped_reasons": skipped_reasons,
    }
    update_fulfillment_fields(order, result, db=db)
    db.commit()

    logger.info(
        "Avito order %s fulfillment done: status=%s processed=%s reused=%s created=%s skipped=%s",
        order_id,
        order.stock_fulfillment_status,
        len(processed_products),
        reused_count,
        created_count,
        len(skipped_reasons),
    )
    return result


def _remove_from_avito_xlsx(
    db: Session,
    organization_id: str,
    processed_products: list[dict[str, Any]],
) -> None:
    """Удалить товары из Avito xlsx файла номенклатуры."""
    from app.services.avito_autoload_xlsx import remove_product_from_avito_autoload

    try:
        avito_dir = Path(__file__).resolve().parents[2] / "uploads" / "avito" / organization_id
        xlsx_path = avito_dir / "autoload.xlsx"

        if not xlsx_path.exists():
            logger.warning("Avito xlsx file not found: %s", xlsx_path)
            return

        existing_bytes = xlsx_path.read_bytes()
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
                logger.info("Removed product %s from Avito xlsx", internal_code)
            except Exception as e:
                logger.error("Error removing product %s from Avito xlsx: %s", internal_code, e)

        xlsx_path.write_bytes(current_bytes)
        _update_avito_cache(db, organization_id, current_bytes)

    except Exception as e:
        logger.error("Error removing products from Avito xlsx: %s", e, exc_info=True)


def _remove_from_drom_xlsx(
    db: Session,
    organization_id: str,
    processed_products: list[dict[str, Any]],
) -> None:
    """Удалить товары из Drom xlsx файла номенклатуры."""
    from app.services.drom_autoload_xlsx import remove_product_from_drom_autoload

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
            logger.warning("Drom xlsx file not found: %s", xlsx_path)
            return

        existing_bytes = xlsx_path.read_bytes()
        current_bytes = existing_bytes
        for product_info in processed_products:
            article = product_info.get("article")
            if not article:
                continue
            try:
                current_bytes = remove_product_from_drom_autoload(current_bytes, article)
                logger.info("Removed product %s from Drom xlsx", article)
            except Exception as e:
                logger.error("Error removing product %s from Drom xlsx: %s", article, e)

        xlsx_path.write_bytes(current_bytes)
        _update_drom_cache(db, organization_id, current_bytes)

    except Exception as e:
        logger.error("Error removing products from Drom xlsx: %s", e, exc_info=True)


def _delete_listing_links(
    db: Session,
    organization_id: str,
    product_ids: list[int],
) -> None:
    """Удалить связи listing для товаров."""
    try:
        avito_deleted = db.query(ProductAvitoListingLink).filter(
            ProductAvitoListingLink.organization_id == organization_id,
            ProductAvitoListingLink.product_id.in_(product_ids),
        ).delete(synchronize_session=False)

        drom_deleted = db.query(ProductDromListingLink).filter(
            ProductDromListingLink.organization_id == organization_id,
            ProductDromListingLink.product_id.in_(product_ids),
        ).delete(synchronize_session=False)

        logger.info("Deleted listing links: %s Avito, %s Drom", avito_deleted, drom_deleted)

    except Exception as e:
        logger.error("Error deleting listing links: %s", e, exc_info=True)


def _update_avito_cache(
    db: Session,
    organization_id: str,
    xlsx_bytes: bytes,
) -> None:
    """Обновить кеш Avito autoload после изменения xlsx файла."""
    try:
        import json

        from app.services.avito_autoload_xlsx import parse_and_validate_avito_autoload

        cache = db.query(OrganizationAvitoAutoloadCache).filter_by(
            organization_id=organization_id
        ).first()

        if not cache:
            return

        parsed = parse_and_validate_avito_autoload(xlsx_bytes)
        cache.items_json = json.dumps(parsed.items, ensure_ascii=False)
        cache.local_validation_ok = parsed.local_ok
        cache.local_errors_json = json.dumps(parsed.local_errors, ensure_ascii=False)
        cache.sheets_parsed_json = json.dumps(parsed.sheets_parsed, ensure_ascii=False)

        logger.info("Updated Avito autoload cache for org %s", organization_id)

    except Exception as e:
        logger.error("Error updating Avito cache: %s", e, exc_info=True)


def _update_drom_cache(
    db: Session,
    organization_id: str,
    xlsx_bytes: bytes,
) -> None:
    """Обновить кеш Drom autoload после изменения xlsx файла."""
    try:
        import json

        from app.services.drom_autoload_xlsx import parse_and_validate_drom_autoload

        cache = db.query(OrganizationDromAutoloadCache).filter_by(
            organization_id=organization_id
        ).first()

        if not cache:
            return

        parsed = parse_and_validate_drom_autoload(xlsx_bytes)
        cache.items_json = json.dumps(parsed.items, ensure_ascii=False)
        cache.local_validation_ok = parsed.local_ok
        cache.local_errors_json = json.dumps(parsed.local_errors, ensure_ascii=False)

        logger.info("Updated Drom autoload cache for org %s", organization_id)

    except Exception as e:
        logger.error("Error updating Drom cache: %s", e, exc_info=True)
