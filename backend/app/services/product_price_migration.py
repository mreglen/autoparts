from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.product import Product as ProductModel
from app.utils.product_price import round_product_price


@dataclass
class ProductPriceMigrationCounters:
    scanned: int = 0
    migrated: int = 0
    skipped: int = 0
    failed: int = 0


@dataclass
class ProductPriceChange:
    product_id: int
    organization_id: str | None
    old_price: float
    new_price: float


@dataclass
class ProductPriceMigrationResult:
    counters: ProductPriceMigrationCounters
    changes: list[ProductPriceChange] = field(default_factory=list)
    failures: list[tuple[int, str]] = field(default_factory=list)


def _has_kopecks(price) -> bool:
    if price is None:
        return False
    amount = Decimal(str(price))
    return amount != amount.quantize(Decimal("1"))


def migrate_product_prices(
    db: Session,
    *,
    dry_run: bool = True,
    org_id: str | None = None,
    limit: int | None = None,
    change_limit: int = 50,
) -> ProductPriceMigrationResult:
    counters = ProductPriceMigrationCounters()
    changes: list[ProductPriceChange] = []
    failures: list[tuple[int, str]] = []

    query = db.query(ProductModel).order_by(ProductModel.id.asc())
    if org_id:
        query = query.filter(ProductModel.organization_id == org_id)
    if limit and limit > 0:
        query = query.limit(limit)
    products = query.all()

    for product in products:
        counters.scanned += 1
        try:
            if product.price is None or not _has_kopecks(product.price):
                counters.skipped += 1
                continue
            new_price = round_product_price(product.price)
            if new_price is None:
                counters.skipped += 1
                continue
            old_price = float(product.price)
            if old_price == new_price:
                counters.skipped += 1
                continue
            if len(changes) < change_limit:
                changes.append(
                    ProductPriceChange(
                        product_id=product.id,
                        organization_id=product.organization_id,
                        old_price=old_price,
                        new_price=new_price,
                    )
                )
            if not dry_run:
                product.price = new_price
            counters.migrated += 1
        except Exception as exc:
            counters.failed += 1
            if len(failures) < change_limit:
                failures.append((product.id, str(exc)))

    if not dry_run and counters.migrated > 0:
        db.commit()

    return ProductPriceMigrationResult(counters=counters, changes=changes, failures=failures)


def format_price_changes_for_output(
    changes: list[ProductPriceChange],
    *,
    limit: int = 50,
) -> list[dict]:
    return [
        {
            "product_id": change.product_id,
            "organization_id": change.organization_id,
            "old_price": change.old_price,
            "new_price": change.new_price,
        }
        for change in changes[:limit]
    ]
