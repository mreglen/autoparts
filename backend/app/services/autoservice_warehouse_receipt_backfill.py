from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from app.models.autoservice_warehouse import (
    AutoserviceWarehouseReceipt,
    AutoserviceWarehouseReceiptDoc,
)
from app.models.repair_order import RepairOrder, RepairOrderShopPart
from app.services.autoservice_warehouse_service import (
    ReceiptDocumentBatch,
    _purchase_order_id_for_cart_item,
    recalculate_autoservice_item_quantities,
    transfer_my_parts_to_autoservice,
)
from app.services.repair_order_stock_reserve import release_shop_part_reservation

logger = logging.getLogger(__name__)


@dataclass
class _LegacyReceiptSnapshot:
    organization_id: str
    item_id: int
    quantity: int
    unit_price: Decimal
    cart_item_type: str | None
    cart_item_id: int | None
    repair_order_id: int | None
    created_by: int
    created_at: date
    brand: str
    article: str
    name: str
    legacy_id: int


def _needs_backfill(db: Session) -> bool:
    orphan_receipts = (
        db.query(AutoserviceWarehouseReceipt)
        .filter(AutoserviceWarehouseReceipt.document_id.is_(None))
        .count()
    )
    if orphan_receipts > 0:
        return True
    warehouse_parts = (
        db.query(RepairOrderShopPart)
        .filter(RepairOrderShopPart.source == "warehouse")
        .count()
    )
    return warehouse_parts > 0


def _snapshot_legacy_receipts(db: Session) -> list[_LegacyReceiptSnapshot]:
    rows = (
        db.query(AutoserviceWarehouseReceipt)
        .options(joinedload(AutoserviceWarehouseReceipt.item))
        .order_by(AutoserviceWarehouseReceipt.id.asc())
        .all()
    )
    snapshots: list[_LegacyReceiptSnapshot] = []
    for row in rows:
        item = row.item
        if not item:
            continue
        snapshots.append(
            _LegacyReceiptSnapshot(
                organization_id=row.organization_id,
                item_id=row.item_id,
                quantity=int(row.quantity or 0),
                unit_price=Decimal(str(row.unit_price or 0)),
                cart_item_type=row.cart_item_type,
                cart_item_id=row.cart_item_id,
                repair_order_id=row.repair_order_id,
                created_by=row.created_by,
                created_at=row.created_at,
                brand=item.brand or "",
                article=item.article or "",
                name=item.name or "",
                legacy_id=row.id,
            )
        )
    return snapshots


def _migrate_warehouse_shop_parts(db: Session) -> int:
    parts = (
        db.query(RepairOrderShopPart)
        .join(RepairOrder, RepairOrderShopPart.order_id == RepairOrder.id)
        .filter(RepairOrderShopPart.source == "warehouse")
        .all()
    )
    migrated = 0
    for part in parts:
        if not part.product_id:
            continue
        order = part.order
        if not order:
            continue
        release_shop_part_reservation(db, part)
        qty = max(1, int(Decimal(str(part.qty or 1)).quantize(Decimal("1"))))
        wh_item, _, _ = transfer_my_parts_to_autoservice(
            db,
            org_id=order.organization_id,
            user_id=order.accepted_by_user_id,
            product_id=part.product_id,
            quantity=qty,
            repair_order_id=order.id,
        )
        part.source = "autoservice_stock"
        part.autoservice_stock_item_id = wh_item.id
        part.product_id = None
        migrated += 1
    db.flush()
    return migrated


def _group_legacy_snapshots(
    db: Session,
    legacy: list[_LegacyReceiptSnapshot],
) -> dict[tuple, list[_LegacyReceiptSnapshot]]:
    grouped: dict[tuple, list[_LegacyReceiptSnapshot]] = {}
    for snap in legacy:
        cart_type = snap.cart_item_type or "manual"
        if cart_type in ("new", "used") and snap.cart_item_id:
            order_type = "new" if cart_type == "new" else "used"
            order_id = _purchase_order_id_for_cart_item(
                db,
                order_type=order_type,
                cart_item_id=snap.cart_item_id,
            )
            key = (
                snap.organization_id,
                "purchase",
                order_type,
                order_id,
                snap.repair_order_id,
                snap.created_at.isoformat(),
            )
        elif cart_type == "my_parts":
            key = (
                snap.organization_id,
                "my_parts",
                None,
                None,
                snap.repair_order_id,
                snap.created_at.isoformat(),
            )
        elif snap.repair_order_id:
            key = (
                snap.organization_id,
                "manual",
                None,
                None,
                snap.repair_order_id,
                snap.created_at.isoformat(),
            )
        else:
            key = (
                snap.organization_id,
                "manual_single",
                snap.legacy_id,
                None,
                None,
                snap.created_at.isoformat(),
            )
        grouped.setdefault(key, []).append(snap)
    return grouped


def backfill_autoservice_receipt_documents(db: Session) -> dict:
    if not _needs_backfill(db):
        return {"skipped": True, "reason": "already_done"}

    warehouse_migrated = _migrate_warehouse_shop_parts(db)
    legacy = _snapshot_legacy_receipts(db)

    db.query(AutoserviceWarehouseReceipt).delete(synchronize_session=False)
    db.query(AutoserviceWarehouseReceiptDoc).delete(synchronize_session=False)
    db.flush()

    docs_created = 0
    lines_created = 0
    grouped = _group_legacy_snapshots(db, legacy)

    for _key, snaps in grouped.items():
        if not snaps:
            continue
        first = snaps[0]
        batch = ReceiptDocumentBatch(
            db,
            org_id=first.organization_id,
            user_id=first.created_by,
            repair_order_id=first.repair_order_id,
        )
        for snap in snaps:
            cart_type = snap.cart_item_type or "manual"
            if cart_type in ("new", "used") and snap.cart_item_id:
                order_type = "new" if cart_type == "new" else "used"
                order_id = _purchase_order_id_for_cart_item(
                    db,
                    order_type=order_type,
                    cart_item_id=snap.cart_item_id,
                )
                if order_id is None:
                    continue
                batch.add_purchase(
                    cart_item_type=cart_type,
                    cart_item_id=snap.cart_item_id,
                    brand=snap.brand,
                    article=snap.article,
                    name=snap.name,
                    quantity=snap.quantity,
                    unit_price=snap.unit_price,
                    source_order_type=order_type,
                    source_order_id=order_id,
                    doc_date=snap.created_at,
                )
            elif cart_type == "my_parts":
                batch.add_my_parts_restored(
                    product_id=snap.cart_item_id,
                    brand=snap.brand,
                    article=snap.article,
                    name=snap.name,
                    quantity=snap.quantity,
                    unit_price=snap.unit_price,
                    doc_date=snap.created_at,
                )
            else:
                batch.add_manual(
                    brand=snap.brand,
                    article=snap.article,
                    name=snap.name,
                    quantity=snap.quantity,
                    unit_price=snap.unit_price,
                    doc_date=snap.created_at,
                )
            lines_created += 1
        created = batch.flush()
        docs_created += len(created)

    items_updated = recalculate_autoservice_item_quantities(db)
    db.commit()

    stats = {
        "skipped": False,
        "warehouse_shop_parts_migrated": warehouse_migrated,
        "legacy_receipts": len(legacy),
        "documents_created": docs_created,
        "lines_created": lines_created,
        "items_recalculated": items_updated,
    }
    logger.info("autoservice receipt documents backfill finished: %s", stats)
    return stats
