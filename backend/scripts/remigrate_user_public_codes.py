"""
Replace invalid or missing users.public_code with format: [A-Z] + 6 non-sequential digits.

  python backend/scripts/remigrate_user_public_codes.py
  python backend/scripts/remigrate_user_public_codes.py --dry-run
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text

from app.db.database import SessionLocal, engine
from app.db.schema_patches import ensure_user_public_code
from app.utils.user_public_code import remigrate_invalid_public_codes


def main() -> None:
    parser = argparse.ArgumentParser(description="Remigrate users.public_code to letter+digits format")
    parser.add_argument("--dry-run", action="store_true", help="Only report, do not write")
    args = parser.parse_args()

    ensure_user_public_code()
    db = SessionLocal()
    try:
        changes = remigrate_invalid_public_codes(db, dry_run=args.dry_run)
        print(f"Users to update: {len(changes)}")
        for user_id, old, new in changes[:30]:
            print(f"  id={user_id}: {old!r} -> {new}")
        if len(changes) > 30:
            print(f"  ... and {len(changes) - 30} more")

        if not args.dry_run and changes:
            dup = db.execute(
                text(
                    """
                    SELECT public_code, COUNT(*) AS cnt FROM users
                    GROUP BY public_code HAVING COUNT(*) > 1 LIMIT 5
                    """
                )
            ).fetchall()
            if dup:
                db.rollback()
                raise RuntimeError(f"Duplicate public_code after migrate: {dup}")
            db.commit()
            print(f"Committed {len(changes)} updates.")
        elif args.dry_run:
            print("Dry run — no changes written.")
        else:
            print("Nothing to update.")
    finally:
        db.close()
    engine.dispose()


if __name__ == "__main__":
    main()
