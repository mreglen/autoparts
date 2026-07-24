"""
Backfill product_photos.thumb_url from existing full image files.

Usage (from backend/):
  python -m app.scripts.generate_product_photo_thumbs [--limit 500] [--batch-size 50]
  python -m app.scripts.generate_product_photo_thumbs --mode force --limit 200
"""
from __future__ import annotations

import argparse
import logging
import sys

from app.db.database import SessionLocal
from app.services.product_photo_thumbs import (
    default_uploads_base_dir,
    generate_thumbs,
)

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate product photo thumbnails")
    parser.add_argument("--limit", type=int, default=500, help="Max photos to process (0 = all)")
    parser.add_argument("--batch-size", type=int, default=50, help="Commit every N photos")
    parser.add_argument(
        "--mode",
        choices=("missing", "force"),
        default="missing",
        help="missing = only without thumb_url; force = recreate in batch",
    )
    args = parser.parse_args(argv)

    base_dir = default_uploads_base_dir()
    db = SessionLocal()
    try:
        result = generate_thumbs(
            db,
            mode=args.mode,
            limit=args.limit,
            batch_size=max(1, args.batch_size),
            base_dir=base_dir,
            invalidate_cache=True,
        )
        logger.info(
            "Done mode=%s processed=%s created=%s linked=%s skipped=%s failed=%s",
            result.mode,
            result.processed,
            result.created,
            result.linked_existing_file,
            result.skipped,
            result.failed,
        )
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
