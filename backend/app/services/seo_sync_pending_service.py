from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.database import engine
from app.models.seo_sync_pending_candidate import SeoSyncPendingCandidate
from app.services.seo_sync_types import SyncCandidate


def enqueue_pending_candidates(db: Session, candidates: list[SyncCandidate]) -> int:
    if not candidates:
        return 0
    inserted = 0
    dialect = engine.dialect.name
    for candidate in candidates:
        existing = (
            db.query(SeoSyncPendingCandidate)
            .filter(SeoSyncPendingCandidate.lookup_key == candidate.lookup_key)
            .first()
        )
        if existing:
            continue
        if dialect == "postgresql":
            from sqlalchemy.dialects.postgresql import insert as pg_insert

            stmt = (
                pg_insert(SeoSyncPendingCandidate)
                .values(
                    lookup_key=candidate.lookup_key,
                    brand=candidate.brand,
                    article=candidate.article,
                    source=candidate.source,
                    priority=0,
                )
                .on_conflict_do_nothing(index_elements=["lookup_key"])
            )
            result = db.execute(stmt)
            if result.rowcount:
                inserted += 1
        else:
            db.add(
                SeoSyncPendingCandidate(
                    lookup_key=candidate.lookup_key,
                    brand=candidate.brand,
                    article=candidate.article,
                    source=candidate.source,
                )
            )
            inserted += 1
    db.commit()
    return inserted


def list_pending_candidates(db: Session, *, limit: int = 500) -> list[SyncCandidate]:
    rows = (
        db.query(SeoSyncPendingCandidate)
        .order_by(SeoSyncPendingCandidate.priority.asc(), SeoSyncPendingCandidate.discovered_at.asc())
        .limit(max(1, limit))
        .all()
    )
    return [
        SyncCandidate(
            lookup_key=row.lookup_key,
            brand=row.brand,
            article=row.article,
            source=row.source,
            origin_source=row.source,
        )
        for row in rows
    ]


def count_pending_candidates(db: Session) -> int:
    return db.query(SeoSyncPendingCandidate).count()
