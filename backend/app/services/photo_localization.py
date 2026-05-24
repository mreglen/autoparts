from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Iterable
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from app.models.organization_avito_integration import OrganizationAvitoIntegration  # noqa: F401
from app.models.product import Product, ProductPhoto
from app.services.avito_media import ensure_local_pictures, is_local_media


@dataclass
class PhotoLocalizationCounters:
    scanned: int = 0
    matched: int = 0
    migrated: int = 0
    skipped: int = 0
    failed: int = 0


@dataclass
class PhotoLocalizationResult:
    counters: PhotoLocalizationCounters
    failures: list[tuple[int, str, str]]


def _is_http_url(value: str) -> bool:
    return value.startswith("http://") or value.startswith("https://")


def _hostname(url: str) -> str:
    try:
        return (urlparse(url).hostname or "").lower()
    except Exception:
        return ""


def _is_avito_like_url(url: str) -> bool:
    host = _hostname(url)
    if not host:
        return False
    if host.endswith("avito.ru") or host.endswith("img.avito.st"):
        return True
    return "avito" in host


def _iter_target_rows(
    db: Session,
    *,
    org_id: str | None,
    process_all_external: bool,
    row_limit: int | None,
) -> list[tuple[ProductPhoto, str | None]]:
    query = (
        db.query(ProductPhoto, Product.organization_id)
        .join(Product, Product.id == ProductPhoto.product_id)
        .order_by(ProductPhoto.id.asc())
    )
    if org_id:
        query = query.filter(Product.organization_id == org_id)
    if row_limit and row_limit > 0:
        query = query.limit(row_limit)

    rows = query.all()
    out: list[tuple[ProductPhoto, str | None]] = []
    for photo, product_org_id in rows:
        raw_url = (photo.photo_url or "").strip()
        if not raw_url:
            continue
        if not _is_http_url(raw_url):
            continue
        if is_local_media(raw_url):
            continue
        if (not process_all_external) and (not _is_avito_like_url(raw_url)):
            continue
        out.append((photo, product_org_id))
    return out


def _localize_single_url(
    db: Session,
    *,
    url: str,
    organization_id: str,
    per_photo_timeout_s: float,
    celery_timeout_s: int,
) -> str:
    result = asyncio.run(
        ensure_local_pictures(
            [url],
            org_id=organization_id,
            db=db,
            for_xlsx=False,
            limit=1,
            soft_fail=False,
            per_photo_timeout_s=per_photo_timeout_s,
            celery_timeout_s=celery_timeout_s,
        )
    )
    if not result:
        raise RuntimeError("ensure_local_pictures returned empty result")
    return str(result[0]).strip()


def migrate_external_product_photos(
    db: Session,
    *,
    dry_run: bool,
    org_id: str | None = None,
    process_all_external: bool = False,
    row_limit: int | None = None,
    per_photo_timeout_s: float = 25.0,
    celery_timeout_s: int = 120,
) -> PhotoLocalizationResult:
    counters = PhotoLocalizationCounters()
    failures: list[tuple[int, str, str]] = []

    rows = _iter_target_rows(
        db,
        org_id=org_id,
        process_all_external=process_all_external,
        row_limit=row_limit,
    )
    counters.scanned = len(rows)
    counters.matched = len(rows)

    if dry_run:
        return PhotoLocalizationResult(counters=counters, failures=failures)

    for photo, product_org_id in rows:
        old_url = (photo.photo_url or "").strip()
        effective_org_id = (photo.organization_id or product_org_id or "").strip()
        if not effective_org_id:
            counters.failed += 1
            failures.append((photo.id, old_url, "organization_id is missing"))
            continue

        try:
            new_url = _localize_single_url(
                db,
                url=old_url,
                organization_id=effective_org_id,
                per_photo_timeout_s=per_photo_timeout_s,
                celery_timeout_s=celery_timeout_s,
            )
            if not new_url:
                raise RuntimeError("empty new_url")
            if _is_http_url(new_url):
                raise RuntimeError("localized url is still external http(s)")

            photo.photo_url = new_url
            photo.organization_id = effective_org_id
            photo.processing_status = "completed"
            db.commit()
            counters.migrated += 1
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            counters.failed += 1
            failures.append((photo.id, old_url, f"{type(exc).__name__}: {exc}"))

    counters.skipped = counters.matched - counters.migrated - counters.failed
    if counters.migrated > 0:
        from app.services.yandex_feed_sync_service import mark_yandex_feed_dirty

        mark_yandex_feed_dirty(db, "photos_localized")
    return PhotoLocalizationResult(counters=counters, failures=failures)


def format_failures_for_output(
    failures: Iterable[tuple[int, str, str]],
    *,
    limit: int = 50,
) -> list[dict[str, str | int]]:
    out: list[dict[str, str | int]] = []
    for photo_id, old_url, reason in list(failures)[:limit]:
        out.append(
            {
                "photo_id": photo_id,
                "old_url": old_url,
                "reason": reason,
            }
        )
    return out

