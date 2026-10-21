#!/usr/bin/env python3
"""Сверка прайс-листов Drom с остатками склада.

Убирает из uploads/drom/<org>/export.xlsx позиции, выписанные через /stock-out,
и возвращает/обновляет те, что снова в наличии. Запуск из каталога backend:
    venv/bin/python scripts/reconcile_drom_price_lists.py [--org <org_id>]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.database import SessionLocal
from app.services.drom_price_list import reconcile_all_drom_price_lists, reconcile_drom_price_list


def main() -> int:
    parser = argparse.ArgumentParser(description="Сверка XLSX прайс-листов Drom")
    parser.add_argument("--org", help="Только указанная организация")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.org:
            result = reconcile_drom_price_list(db, args.org)
        else:
            result = reconcile_all_drom_price_lists(db)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 1 if "error" in result else 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
