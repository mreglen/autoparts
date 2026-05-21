"""Backfill users.public_code for existing rows. Idempotent."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text

from app.db.database import SessionLocal, engine
from app.db.schema_patches import ensure_user_public_code


def main() -> None:
    ensure_user_public_code()
    db = SessionLocal()
    try:
        missing = db.execute(
            text(
                "SELECT COUNT(*) FROM users WHERE public_code IS NULL OR TRIM(public_code) = ''"
            )
        ).scalar()
        if missing:
            db.execute(
                text(
                    """
                    UPDATE users
                    SET public_code = CAST(1000000 + id AS VARCHAR)
                    WHERE public_code IS NULL OR TRIM(public_code) = ''
                    """
                )
            )
            db.commit()
        total = db.execute(text("SELECT COUNT(*) FROM users")).scalar()
        print(f"users.public_code OK, total users: {total}")
    finally:
        db.close()
    engine.dispose()


if __name__ == "__main__":
    main()
