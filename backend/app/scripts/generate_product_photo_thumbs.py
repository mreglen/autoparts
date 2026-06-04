"""
Backfill product_photos.thumb_url from existing full WebP files.

Usage (from backend/):
  python -m app.scripts.generate_product_photo_thumbs [--limit 500] [--batch-size 50]
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.product import ProductPhoto
from app.tasks.photo_tasks import optimize_image
from app.utils.photo_thumb_paths import (
    THUMB_IMAGE_MAX_SIZE,
    THUMB_IMAGE_QUALITY,
    build_thumb_filename,
    build_thumb_media_path,
)

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def _resolve_disk_path(photo_url: str, base_dir: Path) -> Path | None:
    url = (photo_url or "").strip()
    if not url or url.startswith("http://") or url.startswith("https://"):
        return None
    if url.startswith("/uploads/"):
        rel = url[len("/uploads/") :]
    elif url.startswith("/pictures/"):
        rel = url.lstrip("/")
    else:
        rel = url.lstrip("/")
    path = base_dir / "uploads" / rel
    return path if path.is_file() else None


def generate_thumbs_for_batch(
    db: Session,
    *,
    base_dir: Path,
    limit: int,
    batch_size: int,
) -> tuple[int, int, int]:
    processed = 0
    created = 0
    skipped = 0

    query = (
        db.query(ProductPhoto)
        .filter(
            ProductPhoto.processing_status == "completed",
            ProductPhoto.thumb_url.is_(None),
        )
        .order_by(ProductPhoto.id.asc())
    )
    if limit > 0:
        query = query.limit(limit)

    rows = query.all()
    for photo in rows:
        if limit > 0 and processed >= limit:
            break
        processed += 1

        disk_path = _resolve_disk_path(photo.photo_url, base_dir)
        if disk_path is None:
            skipped += 1
            continue

        thumb_filename = build_thumb_filename(disk_path.name)
        thumb_disk = disk_path.parent / thumb_filename
        thumb_media = build_thumb_media_path(photo.photo_url)

        if thumb_disk.is_file():
            photo.thumb_url = thumb_media
            created += 1
            continue

        try:
            image_data = disk_path.read_bytes()
            thumb_bytes = optimize_image(
                image_data,
                max_size=THUMB_IMAGE_MAX_SIZE,
                quality=THUMB_IMAGE_QUALITY,
                watermark_logo_path=None,
            )
            thumb_disk.write_bytes(thumb_bytes)
            photo.thumb_url = thumb_media
            created += 1
        except Exception as exc:
            logger.warning("Skip photo id=%s: %s", photo.id, exc)
            skipped += 1

        if processed % batch_size == 0:
            db.commit()
            logger.info("Progress: processed=%s created=%s skipped=%s", processed, created, skipped)

    db.commit()
    return processed, created, skipped


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate missing product photo thumbnails")
    parser.add_argument("--limit", type=int, default=500, help="Max photos to process (0 = all)")
    parser.add_argument("--batch-size", type=int, default=50, help="Commit every N photos")
    args = parser.parse_args(argv)

    base_dir = Path(__file__).resolve().parent.parent.parent
    db = SessionLocal()
    try:
        processed, created, skipped = generate_thumbs_for_batch(
            db,
            base_dir=base_dir,
            limit=args.limit,
            batch_size=max(1, args.batch_size),
        )
        logger.info(
            "Done: processed=%s thumbs_created_or_linked=%s skipped=%s",
            processed,
            created,
            skipped,
        )
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
