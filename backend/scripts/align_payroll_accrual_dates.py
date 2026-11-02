#!/usr/bin/env python3
"""Перенос начислений ЗП и выплат подрядчикам в месяц «Даты конца» заказ-наряда.

Начисления, созданные до правила «месяц отчёта = дата конца работ», несли дату
`server_default now()` — момент, когда заказ физически закрыли. Если заказ с датой
конца 31.10 закрыли 02.11, его ЗП попадала в ноябрь. Скрипт возвращает такие строки
на дату конца; строки, начисленные раньше плана (заказ закрыли досрочно), не трогаются.

Запуск из каталога backend. По умолчанию — только отчёт:
    venv/bin/python scripts/align_payroll_accrual_dates.py [--org <org_id>]
    venv/bin/python scripts/align_payroll_accrual_dates.py --apply
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy.orm import joinedload

from app.db.database import SessionLocal
from app.models.autoservice_contractor_payout import AutoserviceContractorPayout
from app.models.autoservice_payroll_accrual import AutoservicePayrollAccrual
from app.models.repair_order import RepairOrder

MODELS = (
    ("ЗП", AutoservicePayrollAccrual),
    ("подряд", AutoserviceContractorPayout),
)


def _rows(db, org_id: str | None):
    for kind, model in MODELS:
        query = (
            db.query(model)
            .options(joinedload(model.order))
            .join(RepairOrder, RepairOrder.id == model.order_id)
            .filter(
                RepairOrder.scheduled_end_at.is_not(None),
                model.accrued_at > RepairOrder.scheduled_end_at,
            )
        )
        if org_id:
            query = query.filter(model.organization_id == org_id)
        for row in query.all():
            # Отчёт группировает по месяцу начисления, поэтому переносим только строки,
            # у которых месяц реально изменился: внутри месяца остаются расхождения
            # в несколько часов от старых naive-UTC дат конца.
            if row.accrued_at.strftime("%Y-%m") == row.order.scheduled_end_at.strftime("%Y-%m"):
                continue
            yield kind, row


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--org", help="Только указанная организация")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Перенести найденные начисления (без ключа — только отчёт)",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        rows = list(_rows(db, args.org))
        for kind, row in rows:
            order = row.order
            print(
                f"{'MOVE' if args.apply else 'FOUND'} {kind} accrual={row.id} "
                f"org={row.organization_id} заказ №{order.order_number} "
                f"{row.accrued_at:%Y-%m-%d %H:%M} → {order.scheduled_end_at:%Y-%m-%d %H:%M} "
                f"сумма={row.amount}"
            )
        if not rows:
            print("Начислений, отстающих от даты конца заказ-наряда, нет.")
            return 0
        if not args.apply:
            print(f"\nНайдено: {len(rows)}. Повтори с --apply, чтобы перенести.")
            return 0

        for _, row in rows:
            row.accrued_at = row.order.scheduled_end_at
        db.commit()
        print(f"\nПеренесено: {len(rows)}.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
