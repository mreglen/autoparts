"""
Пересчёт sale_price для исторических stock_out по заказам Авито.

Запуск из каталога backend:
  python -m app.scripts.recalc_avito_stock_out_prices --dry-run
  python -m app.scripts.recalc_avito_stock_out_prices --apply

Операционная памятка:
  1. Продажа Авито учитывается в статистике после статуса closed и синка заказов.
  2. Не дублируйте ручным расходом тот же товар по тому же заказу.
  3. totalSales на дашборде = только /stock-outs/sales (факт списания).
"""

from __future__ import annotations

import argparse
from decimal import Decimal

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.avito_orders_cache import AvitoOrderCache
from app.models.product import Product
from app.models.stock_out import StockOut
from app.services.stock_out_sales import resolve_effective_unit_price


def _needs_recalc(sale_price) -> bool:
    if sale_price is None:
        return True
    try:
        return float(sale_price) <= 0
    except (TypeError, ValueError):
        return True


def recalc_avito_stock_out_prices(*, apply: bool) -> dict[str, int]:
    db: Session = SessionLocal()
    stats = {"updated": 0, "skipped": 0, "not_found": 0, "unchanged": 0}

    try:
        rows = (
            db.query(StockOut)
            .filter(
                StockOut.sale_channel == "avito",
                or_(StockOut.sale_price.is_(None), StockOut.sale_price <= 0),
            )
            .order_by(StockOut.id)
            .all()
        )

        print(f"Найдено записей stock_out (avito, sale_price пустой/0): {len(rows)}\n")

        for so in rows:
            if not so.avito_order_id:
                stats["not_found"] += 1
                print(f"  [skip] stock_out id={so.id}: нет avito_order_id")
                continue

            order = (
                db.query(AvitoOrderCache)
                .filter(
                    AvitoOrderCache.organization_id == so.organization_id,
                    AvitoOrderCache.avito_order_id == str(so.avito_order_id),
                )
                .first()
            )
            if not order or not order.avito_data:
                stats["not_found"] += 1
                print(
                    f"  [skip] stock_out id={so.id}: заказ avito_order_id={so.avito_order_id} не в кэше"
                )
                continue

            product = db.query(Product).filter(Product.id == so.product_id).first()
            new_unit = resolve_effective_unit_price(db, so)

            if new_unit <= 0:
                stats["skipped"] += 1
                product_price = float(product.price or 0) if product else 0.0
                print(
                    f"  [skip] stock_out id={so.id}: не удалось вычислить цену "
                    f"(product.price={product_price})"
                )
                continue

            old_price = float(so.sale_price or 0)
            if abs(old_price - new_unit) < 0.01:
                stats["unchanged"] += 1
                continue

            line_total = new_unit * int(so.quantity or 1)
            print(
                f"  [{'APPLY' if apply else 'dry-run'}] stock_out id={so.id} "
                f"avito_order={so.avito_order_id} product={so.product_id}: "
                f"{old_price} -> {new_unit} (строка {line_total:.2f} ₽)"
            )

            if apply:
                so.sale_price = Decimal(str(round(new_unit, 2)))
            stats["updated"] += 1

        if apply and stats["updated"] > 0:
            db.commit()
            print("\nИзменения сохранены в БД.")
        elif not apply:
            print("\nРежим dry-run: БД не изменена. Запустите с --apply для сохранения.")
        else:
            print("\nНет изменений для сохранения.")

        print(
            f"\nИтого: updated={stats['updated']} skipped={stats['skipped']} "
            f"not_found={stats['not_found']} unchanged={stats['unchanged']}"
        )
        return stats
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Пересчитать sale_price для stock_out Авито с нулевой ценой"
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--dry-run", action="store_true", help="Только отчёт, без записи в БД")
    group.add_argument("--apply", action="store_true", help="Сохранить изменения в БД")
    args = parser.parse_args()
    recalc_avito_stock_out_prices(apply=args.apply)


if __name__ == "__main__":
    main()
