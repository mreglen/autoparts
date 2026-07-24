"""Re-queue stuck product photos (temp / unfinished processing) via Celery."""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.organization import Organization
from app.models.product import Product, ProductPhoto
from app.models.user import User
from app.tasks.photo_tasks import process_and_upload_photo
from app.utils.photo_naming import generate_photo_filename
from app.utils.public_catalog_cache import invalidate_public_catalog_cache

logger = logging.getLogger(__name__)

UNFINISHED_STATUSES = ("pending", "processing", "failed")


@dataclass
class ReprocessStats:
    total_photos: int = 0
    temp_url: int = 0
    unfinished_status: int = 0
    reprocess_candidates: int = 0


@dataclass
class ReprocessFailure:
    photo_id: int
    photo_url: str
    reason: str


@dataclass
class ReprocessResult:
    processed: int = 0
    queued: int = 0
    skipped: int = 0
    failed: int = 0
    task_ids: list[str] = field(default_factory=list)
    failures: list[ReprocessFailure] = field(default_factory=list)


def default_uploads_base_dir() -> Path:
    return Path(__file__).resolve().parent.parent.parent


def _is_temp_photo_url(url: str | None) -> bool:
    u = (url or "").strip()
    return u.startswith("/temp/") or u.startswith("/uploads/temp/")


def resolve_temp_disk_path(photo_url: str, base_dir: Path) -> Path | None:
    """Map /temp/... or /uploads/temp/... to uploads/temp/... on disk."""
    url = (photo_url or "").strip()
    if not url:
        return None
    if url.startswith("/uploads/temp/"):
        rel = url[len("/uploads/") :]
    elif url.startswith("/temp/"):
        rel = f"temp/{url[len('/temp/'):]}"
    else:
        return None
    path = (base_dir / "uploads" / rel).resolve()
    uploads_root = (base_dir / "uploads").resolve()
    try:
        path.relative_to(uploads_root)
    except ValueError:
        return None
    return path if path.is_file() else None


def _parse_temp_org_and_filename(photo_url: str) -> tuple[str | None, str | None]:
    url = (photo_url or "").strip()
    if url.startswith("/uploads/temp/"):
        parts = url[len("/uploads/temp/") :].split("/")
    elif url.startswith("/temp/"):
        parts = url[len("/temp/") :].split("/")
    else:
        return None, None
    if len(parts) < 2:
        return None, None
    org_id = parts[0]
    filename = "/".join(parts[1:])
    if not org_id or not filename:
        return None, None
    return org_id, filename


def _resolve_watermark(db: Session, organization_id: str) -> tuple[bool, str | None]:
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org or org.watermark is None:
        return False, None

    logo_file_path = None
    add_watermark = False

    def _logo_to_path(logo_value: str) -> str:
        logo_path_value = logo_value.lstrip("/").lstrip("\\")
        if not logo_path_value.lower().startswith("uploads"):
            return os.path.join("uploads", logo_path_value)
        return logo_path_value

    if org.watermark == 1:
        admin_user = db.query(User).filter(User.is_admin == True).first()  # noqa: E712
        if admin_user and admin_user.organization_id:
            admin_org = (
                db.query(Organization)
                .filter(Organization.id == admin_user.organization_id)
                .first()
            )
            if admin_org and admin_org.logo_organization:
                add_watermark = True
                logo_file_path = _logo_to_path(admin_org.logo_organization)
    elif org.watermark == 2 and org.logo_organization:
        add_watermark = True
        logo_file_path = _logo_to_path(org.logo_organization)

    return add_watermark, logo_file_path


def _candidates_filter():
    return or_(
        ProductPhoto.photo_url.like("/temp/%"),
        ProductPhoto.photo_url.like("/uploads/temp/%"),
        ProductPhoto.processing_status.in_(list(UNFINISHED_STATUSES)),
    )


def get_reprocess_stats(db: Session) -> ReprocessStats:
    total = int(db.query(func.count(ProductPhoto.id)).scalar() or 0)
    temp_url = int(
        db.query(func.count(ProductPhoto.id))
        .filter(
            or_(
                ProductPhoto.photo_url.like("/temp/%"),
                ProductPhoto.photo_url.like("/uploads/temp/%"),
            )
        )
        .scalar()
        or 0
    )
    unfinished = int(
        db.query(func.count(ProductPhoto.id))
        .filter(ProductPhoto.processing_status.in_(list(UNFINISHED_STATUSES)))
        .scalar()
        or 0
    )
    candidates = int(
        db.query(func.count(ProductPhoto.id)).filter(_candidates_filter()).scalar() or 0
    )
    return ReprocessStats(
        total_photos=total,
        temp_url=temp_url,
        unfinished_status=unfinished,
        reprocess_candidates=candidates,
    )


def enqueue_photo_reprocess(
    db: Session,
    photo: ProductPhoto,
    *,
    base_dir: Path | None = None,
) -> tuple[bool, str | None, str | None]:
    """
    Queue Celery process_and_upload_photo for one ProductPhoto.
    Returns (ok, task_id, error_reason).
    """
    root = base_dir or default_uploads_base_dir()
    url = (photo.photo_url or "").strip()

    if not _is_temp_photo_url(url):
        return False, None, "not_temp_url"

    disk_path = resolve_temp_disk_path(url, root)
    if disk_path is None:
        return False, None, "temp_file_not_found"

    org_id, temp_filename = _parse_temp_org_and_filename(url)
    if not org_id or not temp_filename:
        return False, None, "invalid_temp_path"

    # Prefer org from product / photo record when temp URL org differs
    product = db.query(Product).filter(Product.id == photo.product_id).first()
    organization_id = (
        (photo.organization_id or "").strip()
        or (product.organization_id if product else None)
        or org_id
    )

    add_watermark, logo_path = _resolve_watermark(db, organization_id)
    final_filename = generate_photo_filename(organization_id, temp_filename)

    try:
        task = process_and_upload_photo.delay(
            str(disk_path),
            final_filename,
            organization_id,
            "pictures",
            add_watermark,
            logo_path,
            None,  # vehicle_photo_id
        )
    except Exception as exc:
        logger.warning("Failed to enqueue photo id=%s: %s", photo.id, exc)
        return False, None, f"enqueue_failed:{exc}"[:280]

    photo.processing_status = "processing"
    return True, str(task.id), None


def reprocess_stuck_photos(
    db: Session,
    *,
    limit: int = 50,
    base_dir: Path | None = None,
    failure_limit: int = 30,
    only_temp: bool = True,
    invalidate_cache: bool = True,
) -> ReprocessResult:
    """
    Enqueue Celery for stuck photos.
    By default only rows with /temp/ URLs (safest: file still in temp).
    If only_temp=False, also includes unfinished statuses (still requires temp file).
    """
    limit = max(1, min(int(limit), 500))
    root = base_dir or default_uploads_base_dir()
    result = ReprocessResult()

    query = db.query(ProductPhoto).order_by(ProductPhoto.id.asc())
    if only_temp:
        query = query.filter(
            or_(
                ProductPhoto.photo_url.like("/temp/%"),
                ProductPhoto.photo_url.like("/uploads/temp/%"),
            )
        )
    else:
        query = query.filter(_candidates_filter())
    rows = query.limit(limit).all()

    for photo in rows:
        result.processed += 1
        url = (photo.photo_url or "").strip()

        # Unfinished but already in /pictures/ — cannot re-run without original temp
        if not _is_temp_photo_url(url):
            result.skipped += 1
            if len(result.failures) < failure_limit:
                result.failures.append(
                    ReprocessFailure(
                        photo_id=int(photo.id),
                        photo_url=url,
                        reason="not_temp_url",
                    )
                )
            continue

        ok, task_id, err = enqueue_photo_reprocess(db, photo, base_dir=root)
        if ok and task_id:
            result.queued += 1
            if len(result.task_ids) < 50:
                result.task_ids.append(task_id)
        elif err == "temp_file_not_found" or err == "not_temp_url" or err == "invalid_temp_path":
            result.skipped += 1
            if len(result.failures) < failure_limit:
                result.failures.append(
                    ReprocessFailure(
                        photo_id=int(photo.id),
                        photo_url=url,
                        reason=err or "skipped",
                    )
                )
        else:
            result.failed += 1
            if len(result.failures) < failure_limit:
                result.failures.append(
                    ReprocessFailure(
                        photo_id=int(photo.id),
                        photo_url=url,
                        reason=err or "failed",
                    )
                )

    db.commit()

    if invalidate_cache and result.queued > 0:
        try:
            invalidate_public_catalog_cache()
        except Exception as exc:
            logger.warning("Catalog cache invalidate failed: %s", exc)

    return result
