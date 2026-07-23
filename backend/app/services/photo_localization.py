from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Iterable
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from app.models.organization import Organization
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
class PhotoLocalizationOrgSummary:
    org_id: str
    org_name: str = ""
    avito_photo_count: int = 0
    scanned: int = 0
    matched: int = 0
    migrated: int = 0
    failed: int = 0
    skipped: int = 0


@dataclass
class PhotoLocalizationResult:
    counters: PhotoLocalizationCounters
    failures: list[tuple[int, str, str]]
    by_org: list[PhotoLocalizationOrgSummary] = field(default_factory=list)


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


def _normalize_org_ids(
    *,
    org_id: str | None = None,
    org_ids: list[str] | None = None,
) -> list[str] | None:
    """Return unique org ids, or None when no org filter should be applied."""
    values: list[str] = []
    if org_ids:
        values.extend(str(v).strip() for v in org_ids if str(v or "").strip())
    if org_id and str(org_id).strip():
        values.append(str(org_id).strip())
    if not values:
        return None
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out


def list_orgs_with_avito_photos(db: Session) -> list[PhotoLocalizationOrgSummary]:
    """Organizations that still have product photos hosted on Avito CDN."""
    orgs = {
        str(org.id): (org.name or "").strip()
        for org in db.query(Organization.id, Organization.name).all()
    }
    query = (
        db.query(ProductPhoto, Product.organization_id)
        .join(Product, Product.id == ProductPhoto.product_id)
        .order_by(ProductPhoto.id.asc())
    )
    counts: dict[str, int] = {}
    for photo, product_org_id in query.all():
        raw_url = (photo.photo_url or "").strip()
        if not raw_url or not _is_http_url(raw_url) or is_local_media(raw_url):
            continue
        if not _is_avito_like_url(raw_url):
            continue
        org_key = str(photo.organization_id or product_org_id or "").strip()
        if not org_key:
            continue
        counts[org_key] = counts.get(org_key, 0) + 1

    rows = [
        PhotoLocalizationOrgSummary(
            org_id=org_id,
            org_name=orgs.get(org_id, ""),
            avito_photo_count=count,
        )
        for org_id, count in counts.items()
    ]
    rows.sort(key=lambda row: (-row.avito_photo_count, (row.org_name or row.org_id).lower()))
    return rows


def _iter_target_rows(
    db: Session,
    *,
    org_id: str | None = None,
    org_ids: list[str] | None = None,
    process_all_external: bool,
    row_limit: int | None,
) -> list[tuple[ProductPhoto, str | None]]:
    query = (
        db.query(ProductPhoto, Product.organization_id)
        .join(Product, Product.id == ProductPhoto.product_id)
        .order_by(ProductPhoto.id.asc())
    )
    normalized_ids = _normalize_org_ids(org_id=org_id, org_ids=org_ids)
    if normalized_ids is not None:
        if len(normalized_ids) == 1:
            query = query.filter(Product.organization_id == normalized_ids[0])
        else:
            query = query.filter(Product.organization_id.in_(normalized_ids))
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
    org_ids: list[str] | None = None,
    process_all_external: bool = False,
    row_limit: int | None = None,
    per_photo_timeout_s: float = 25.0,
    celery_timeout_s: int = 120,
) -> PhotoLocalizationResult:
    counters = PhotoLocalizationCounters()
    failures: list[tuple[int, str, str]] = []
    by_org_map: dict[str, PhotoLocalizationOrgSummary] = {}
    org_names = {
        str(org.id): (org.name or "").strip()
        for org in db.query(Organization.id, Organization.name).all()
    }

    def _org_bucket(effective_org_id: str) -> PhotoLocalizationOrgSummary:
        if effective_org_id not in by_org_map:
            by_org_map[effective_org_id] = PhotoLocalizationOrgSummary(
                org_id=effective_org_id,
                org_name=org_names.get(effective_org_id, ""),
            )
        return by_org_map[effective_org_id]

    rows = _iter_target_rows(
        db,
        org_id=org_id,
        org_ids=org_ids,
        process_all_external=process_all_external,
        row_limit=row_limit,
    )
    counters.scanned = len(rows)
    counters.matched = len(rows)

    for photo, product_org_id in rows:
        effective_org_id = str(photo.organization_id or product_org_id or "").strip() or "unknown"
        bucket = _org_bucket(effective_org_id)
        bucket.scanned += 1
        bucket.matched += 1
        bucket.avito_photo_count += 1

    if dry_run:
        by_org = sorted(
            by_org_map.values(),
            key=lambda row: (-row.matched, (row.org_name or row.org_id).lower()),
        )
        return PhotoLocalizationResult(counters=counters, failures=failures, by_org=by_org)

    for photo, product_org_id in rows:
        old_url = (photo.photo_url or "").strip()
        effective_org_id = (photo.organization_id or product_org_id or "").strip()
        bucket = _org_bucket(effective_org_id or "unknown")
        if not effective_org_id:
            counters.failed += 1
            bucket.failed += 1
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
            bucket.migrated += 1
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            counters.failed += 1
            bucket.failed += 1
            failures.append((photo.id, old_url, f"{type(exc).__name__}: {exc}"))

    counters.skipped = counters.matched - counters.migrated - counters.failed
    for bucket in by_org_map.values():
        bucket.skipped = bucket.matched - bucket.migrated - bucket.failed
    if counters.migrated > 0:
        from app.services.yandex_feed_sync_service import mark_yandex_feed_dirty

        mark_yandex_feed_dirty(db, "photos_localized")
    by_org = sorted(
        by_org_map.values(),
        key=lambda row: (-row.matched, (row.org_name or row.org_id).lower()),
    )
    return PhotoLocalizationResult(counters=counters, failures=failures, by_org=by_org)


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

