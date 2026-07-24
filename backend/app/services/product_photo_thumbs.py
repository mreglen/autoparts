"""Generate and report product photo list thumbnails (thumb WebP)."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.product import ProductPhoto
from app.tasks.photo_tasks import optimize_image
from app.utils.photo_thumb_paths import (
    THUMB_IMAGE_MAX_SIZE,
    THUMB_IMAGE_QUALITY,
    build_thumb_filename,
    build_thumb_media_path,
)
from app.utils.public_catalog_cache import invalidate_public_catalog_cache

logger = logging.getLogger(__name__)

ThumbMode = Literal["missing", "force"]


@dataclass
class ThumbsStats:
    total: int = 0
    with_thumb: int = 0
    missing_thumb: int = 0
    external_skipped: int = 0


@dataclass
class ThumbFailure:
    photo_id: int
    photo_url: str
    reason: str


@dataclass
class ThumbsGenerateResult:
    mode: str
    processed: int = 0
    created: int = 0
    linked_existing_file: int = 0
    skipped: int = 0
    failed: int = 0
    failures: list[ThumbFailure] = field(default_factory=list)


def default_uploads_base_dir() -> Path:
    """backend/ → repo root (…/autoparts)."""
    return Path(__file__).resolve().parent.parent.parent


def is_external_photo_url(photo_url: str | None) -> bool:
    url = (photo_url or "").strip().lower()
    return url.startswith("http://") or url.startswith("https://")


def resolve_photo_disk_path(photo_url: str, base_dir: Path) -> Path | None:
    """Map photo_url to a file under ``{base_dir}/uploads``."""
    url = (photo_url or "").strip()
    if not url or is_external_photo_url(url):
        return None

    if url.startswith("/uploads/"):
        rel = url[len("/uploads/") :]
    elif url.startswith("/temp/"):
        rel = f"temp/{url[len('/temp/'):]}"
    elif url.startswith("/pictures/"):
        rel = url.lstrip("/")
    else:
        rel = url.lstrip("/")

    path = (base_dir / "uploads" / rel).resolve()
    uploads_root = (base_dir / "uploads").resolve()
    try:
        path.relative_to(uploads_root)
    except ValueError:
        return None
    return path if path.is_file() else None


def _thumb_media_url(photo_url: str) -> str:
    url = (photo_url or "").strip()
    return build_thumb_media_path(url)


def get_thumbs_stats(db: Session) -> ThumbsStats:
    total = int(db.query(func.count(ProductPhoto.id)).scalar() or 0)
    with_thumb = int(
        db.query(func.count(ProductPhoto.id))
        .filter(
            ProductPhoto.thumb_url.isnot(None),
            ProductPhoto.thumb_url != "",
        )
        .scalar()
        or 0
    )
    external = int(
        db.query(func.count(ProductPhoto.id))
        .filter(
            or_(
                ProductPhoto.photo_url.ilike("http://%"),
                ProductPhoto.photo_url.ilike("https://%"),
            )
        )
        .scalar()
        or 0
    )
    missing = int(
        db.query(func.count(ProductPhoto.id))
        .filter(
            or_(ProductPhoto.thumb_url.is_(None), ProductPhoto.thumb_url == ""),
            ~ProductPhoto.photo_url.ilike("http://%"),
            ~ProductPhoto.photo_url.ilike("https://%"),
        )
        .scalar()
        or 0
    )
    return ThumbsStats(
        total=total,
        with_thumb=with_thumb,
        missing_thumb=missing,
        external_skipped=external,
    )


def generate_thumbs(
    db: Session,
    *,
    mode: ThumbMode = "missing",
    limit: int = 500,
    batch_size: int = 50,
    base_dir: Path | None = None,
    failure_limit: int = 30,
    invalidate_cache: bool = True,
) -> ThumbsGenerateResult:
    if mode not in ("missing", "force"):
        raise ValueError(f"Unknown mode: {mode}")

    root = base_dir or default_uploads_base_dir()
    batch_size = max(1, int(batch_size))
    limit = max(0, int(limit))
    result = ThumbsGenerateResult(mode=mode)

    query = db.query(ProductPhoto).order_by(ProductPhoto.id.asc())
    if mode == "missing":
        query = query.filter(
            or_(ProductPhoto.thumb_url.is_(None), ProductPhoto.thumb_url == ""),
        )
    query = query.filter(
        ~ProductPhoto.photo_url.ilike("http://%"),
        ~ProductPhoto.photo_url.ilike("https://%"),
    )
    if limit > 0:
        query = query.limit(limit)

    rows = query.all()
    for photo in rows:
        result.processed += 1
        url = (photo.photo_url or "").strip()

        if is_external_photo_url(url):
            result.skipped += 1
            continue

        disk_path = resolve_photo_disk_path(url, root)
        if disk_path is None:
            result.skipped += 1
            if len(result.failures) < failure_limit:
                result.failures.append(
                    ThumbFailure(
                        photo_id=int(photo.id),
                        photo_url=url,
                        reason="file_not_found",
                    )
                )
            continue

        thumb_filename = build_thumb_filename(disk_path.name)
        thumb_disk = disk_path.parent / thumb_filename
        thumb_media = _thumb_media_url(url)

        try:
            if mode == "missing" and thumb_disk.is_file():
                photo.thumb_url = thumb_media
                result.linked_existing_file += 1
            else:
                image_data = disk_path.read_bytes()
                thumb_bytes = optimize_image(
                    image_data,
                    max_size=THUMB_IMAGE_MAX_SIZE,
                    quality=THUMB_IMAGE_QUALITY,
                    watermark_logo_path=None,
                )
                thumb_disk.write_bytes(thumb_bytes)
                photo.thumb_url = thumb_media
                result.created += 1
        except Exception as exc:
            logger.warning("Thumb failed photo id=%s: %s", photo.id, exc)
            result.failed += 1
            if len(result.failures) < failure_limit:
                result.failures.append(
                    ThumbFailure(
                        photo_id=int(photo.id),
                        photo_url=url,
                        reason=str(exc)[:300],
                    )
                )

        if result.processed % batch_size == 0:
            db.commit()
            logger.info(
                "Thumbs progress: processed=%s created=%s linked=%s skipped=%s failed=%s",
                result.processed,
                result.created,
                result.linked_existing_file,
                result.skipped,
                result.failed,
            )

    db.commit()

    if invalidate_cache and (result.created > 0 or result.linked_existing_file > 0):
        try:
            invalidate_public_catalog_cache()
        except Exception as exc:
            logger.warning("Catalog cache invalidate failed: %s", exc)

    return result


def generate_thumbs_for_batch(
    db: Session,
    *,
    base_dir: Path,
    limit: int,
    batch_size: int,
) -> tuple[int, int, int]:
    """CLI-compatible wrapper: (processed, created_or_linked, skipped_or_failed)."""
    result = generate_thumbs(
        db,
        mode="missing",
        limit=limit,
        batch_size=batch_size,
        base_dir=base_dir,
        invalidate_cache=False,
    )
    created_or_linked = result.created + result.linked_existing_file
    skipped = result.skipped + result.failed
    return result.processed, created_or_linked, skipped
