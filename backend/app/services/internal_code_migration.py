from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.models.pending_product import PendingProduct as PendingProductModel
from app.models.product import Product as ProductModel
from app.models.product_avito_listing_link import ProductAvitoListingLink
from app.utils.internal_code import is_valid_internal_code, next_internal_code, org_prefix


@dataclass
class InternalCodeMigrationCounters:
    scanned: int = 0
    migrated: int = 0
    skipped: int = 0
    failed: int = 0


@dataclass
class InternalCodeChange:
    entity_type: str
    entity_id: int
    organization_id: str | None
    old_code: str
    new_code: str


@dataclass
class InternalCodeMigrationResult:
    counters: InternalCodeMigrationCounters
    changes: list[InternalCodeChange] = field(default_factory=list)
    failures: list[tuple[str, int, str]] = field(default_factory=list)


def _update_avito_links(
    db: Session,
    *,
    organization_id: str | None,
    product_id: int,
    old_code: str,
    new_code: str,
    dry_run: bool,
) -> None:
    if not organization_id or dry_run:
        return
    links = (
        db.query(ProductAvitoListingLink)
        .filter(
            ProductAvitoListingLink.product_id == product_id,
            ProductAvitoListingLink.organization_id == organization_id,
            ProductAvitoListingLink.avito_ad_id == old_code,
        )
        .all()
    )
    for link in links:
        link.avito_ad_id = new_code


def migrate_internal_codes(
    db: Session,
    *,
    dry_run: bool = True,
    org_id: str | None = None,
    limit: int | None = None,
    change_limit: int = 50,
) -> InternalCodeMigrationResult:
    counters = InternalCodeMigrationCounters()
    changes: list[InternalCodeChange] = []
    failures: list[tuple[str, int, str]] = []
    reserved_codes: set[str] = set()

    product_query = db.query(ProductModel).order_by(ProductModel.id.asc())
    if org_id:
        product_query = product_query.filter(ProductModel.organization_id == org_id)
    if limit and limit > 0:
        product_query = product_query.limit(limit)
    products = product_query.all()

    for product in products:
        counters.scanned += 1
        old_code = (product.internal_code or "").strip()
        if is_valid_internal_code(old_code):
            counters.skipped += 1
            continue
        if not product.organization_id:
            counters.failed += 1
            failures.append(("product", product.id, "missing organization_id"))
            continue
        try:
            new_code = next_internal_code(
                db,
                product.organization_id,
                reserved_codes=reserved_codes,
            )
            reserved_codes.add(new_code)
            changes.append(
                InternalCodeChange(
                    entity_type="product",
                    entity_id=product.id,
                    organization_id=product.organization_id,
                    old_code=old_code,
                    new_code=new_code,
                )
            )
            if not dry_run:
                _update_avito_links(
                    db,
                    organization_id=product.organization_id,
                    product_id=product.id,
                    old_code=old_code,
                    new_code=new_code,
                    dry_run=dry_run,
                )
                product.internal_code = new_code
            counters.migrated += 1
        except Exception as exc:
            counters.failed += 1
            failures.append(("product", product.id, str(exc)))

    pending_query = db.query(PendingProductModel).order_by(PendingProductModel.id.asc())
    if org_id:
        pending_query = pending_query.filter(PendingProductModel.organization_id == org_id)
    if limit and limit > 0:
        pending_query = pending_query.limit(limit)
    pending_rows = pending_query.all()

    for pending in pending_rows:
        counters.scanned += 1
        old_code = (pending.internal_code or "").strip()
        if is_valid_internal_code(old_code):
            counters.skipped += 1
            continue
        if not pending.organization_id:
            counters.failed += 1
            failures.append(("pending_product", pending.id, "missing organization_id"))
            continue
        try:
            new_code = next_internal_code(
                db,
                pending.organization_id,
                reserved_codes=reserved_codes,
            )
            reserved_codes.add(new_code)
            changes.append(
                InternalCodeChange(
                    entity_type="pending_product",
                    entity_id=pending.id,
                    organization_id=pending.organization_id,
                    old_code=old_code,
                    new_code=new_code,
                )
            )
            if not dry_run:
                pending.internal_code = new_code
            counters.migrated += 1
        except Exception as exc:
            counters.failed += 1
            failures.append(("pending_product", pending.id, str(exc)))

    if not dry_run:
        db.commit()

    return InternalCodeMigrationResult(
        counters=counters,
        changes=changes[:change_limit],
        failures=failures[:change_limit],
    )


def format_changes_for_output(changes: list[InternalCodeChange], limit: int = 50) -> list[dict]:
    rows = changes[:limit]
    return [
        {
            "entity_type": row.entity_type,
            "entity_id": row.entity_id,
            "organization_id": row.organization_id,
            "old_code": row.old_code,
            "new_code": row.new_code,
            "prefix": org_prefix(row.organization_id) if row.organization_id else None,
        }
        for row in rows
    ]
