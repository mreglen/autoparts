"""
One-time migration script for external product photo URLs.

Usage examples:
  python -m app.scripts.localize_external_product_photos --dry-run
  python -m app.scripts.localize_external_product_photos
  python -m app.scripts.localize_external_product_photos --all-external --limit 500
"""

import argparse

from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.services.photo_localization import (
    format_failures_for_output,
    migrate_external_product_photos,
)


def _print_failures(failures: list[dict[str, str | int]]) -> None:
    if not failures:
        return
    print("\nFailed rows:")
    for row in failures:
        print(
            f"  photo_id={row['photo_id']} "
            f"reason={row['reason']} old_url={row['old_url']}"
        )
    if len(failures) > 50:
        print(f"  ... and {len(failures) - 50} more")


def run(
    *,
    dry_run: bool,
    org_id: str | None,
    process_all_external: bool,
    row_limit: int | None,
    per_photo_timeout_s: float,
    celery_timeout_s: int,
) -> int:
    db: Session = SessionLocal()
    try:
        result = migrate_external_product_photos(
            db,
            dry_run=dry_run,
            org_id=org_id,
            process_all_external=process_all_external,
            row_limit=row_limit,
            per_photo_timeout_s=per_photo_timeout_s,
            celery_timeout_s=celery_timeout_s,
        )

        counters = result.counters
        print(f"Rows to process: {counters.matched}")
        if dry_run:
            print("Dry-run mode: no database writes.")
            return 0

        print("\nMigration summary:")
        print(f"  scanned : {counters.scanned}")
        print(f"  matched : {counters.matched}")
        print(f"  migrated: {counters.migrated}")
        print(f"  failed  : {counters.failed}")
        print(f"  skipped : {counters.skipped}")
        _print_failures(format_failures_for_output(result.failures, limit=50))
        return 1 if counters.failed else 0
    finally:
        db.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Migrate external product photo URLs to local /pictures paths.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only print rows that would be migrated.",
    )
    parser.add_argument(
        "--org-id",
        default=None,
        help="Process only this organization id.",
    )
    parser.add_argument(
        "--all-external",
        action="store_true",
        help="Process all external http(s) URLs, not only Avito/CDN hosts.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of queried rows before filtering.",
    )
    parser.add_argument(
        "--per-photo-timeout-s",
        type=float,
        default=25.0,
        help="HTTP timeout per external photo download.",
    )
    parser.add_argument(
        "--celery-timeout-s",
        type=int,
        default=120,
        help="Timeout for photo processing celery task.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    exit_code = run(
        dry_run=bool(args.dry_run),
        org_id=args.org_id,
        process_all_external=bool(args.all_external),
        row_limit=args.limit,
        per_photo_timeout_s=float(args.per_photo_timeout_s),
        celery_timeout_s=int(args.celery_timeout_s),
    )
    raise SystemExit(exit_code)

