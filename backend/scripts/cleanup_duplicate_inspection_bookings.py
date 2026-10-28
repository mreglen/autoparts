#!/usr/bin/env python3
"""Удаление записей на осмотр, которые уже закрыты заказ-нарядом.

Кандидат — запись на осмотр, для которой есть заказ-наряд той же организации с тем же
client_id и с той же «Датой записи на осмотр» (дата + время совпадают посекундно).
Планировщик такие записи скрывает, а скрипт убирает их из таблицы, чтобы они не остались
в «Записях» и в календаре iPhone.

Запуск из каталога backend. По умолчанию — только отчёт, ничего не удаляется:
    venv/bin/python scripts/cleanup_duplicate_inspection_bookings.py [--org <org_id>]
    venv/bin/python scripts/cleanup_duplicate_inspection_bookings.py --apply
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.database import SessionLocal
from app.services.autoservice_audit import log_autoservice
from app.services.autoservice_caldav import request_org_sync
from app.services.autoservice_inspection_duplicates import find_covered_bookings


def _describe(booking, order_label: str) -> str:
    clock = booking.preferred_time.strftime("%H:%M") if booking.preferred_time else "—"
    return (
        f"org={booking.organization_id} booking={booking.id} "
        f"«{booking.name}» {booking.preferred_date} {clock} client_id={booking.client_id} "
        f"→ {order_label}"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--org", help="Только указанная организация")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Удалить найденные записи (без ключа — только отчёт)",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        rows = [
            (booking, booking.organization_id, booking.id, order_label)
            for booking, order_label in find_covered_bookings(db, args.org)
        ]
        for booking, _, _, order_label in rows:
            print(f"{'DELETE' if args.apply else 'FOUND'} {_describe(booking, order_label)}")
        if not rows:
            print("Записей, закрытых заказ-нарядами, не найдено.")
            return 0
        if not args.apply:
            print(f"\nНайдено: {len(rows)}. Повтори с --apply, чтобы удалить.")
            return 0

        org_ids: set[str] = set()
        for booking, org_id, booking_id, order_label in rows:
            db.delete(booking)
            org_ids.add(org_id)
            log_autoservice(
                db,
                event_type="inspection_booking_deleted",
                summary=f"Удалена запись на осмотр, закрытая заказ-нарядом {order_label}",
                user=None,
                organization_id=org_id,
                entity_type="inspection_booking",
                entity_id=booking_id,
                details={"repair_order_label": order_label, "source": "cleanup_script"},
            )
        db.commit()
        for org_id in org_ids:
            request_org_sync(org_id)
        print(f"\nУдалено: {len(rows)}.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
