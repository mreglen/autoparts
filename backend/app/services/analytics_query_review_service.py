from __future__ import annotations

import datetime as dt
from typing import Any

from sqlalchemy.orm import Session

from app.models.analytics_query_review import AnalyticsQueryReviewItem, AnalyticsQueryReviewSnapshot
from app.schemas.site_analytics import (
    AnalyticsQueryReviewItemOut,
    AnalyticsQueryReviewSnapshotOut,
)
from app.services.search_resolve_service import resolve_search_query
from app.services.seo_kpi_service import _normalize_yandex_rows
from app.services.seo_semantics_service import classify_query_cluster
from app.services.yandex_webmaster_service import (
    YandexApiError,
    get_popular_search_queries,
    get_user,
    get_valid_access_token,
)
from app.utils.yandex_integration_db import get_or_create_yandex_integration


RECOMMENDATION_LABELS = {
    "covered": "Страница есть",
    "create_landing": "Создать посадочную",
    "improve_title": "Улучшить title",
    "review": "Проверить вручную",
}

LANDING_KIND_BY_CLUSTER = {
    "B": ("brand_new", "brand_used"),
    "C": ("category_new", "category_used"),
    "D": ("geo",),
}


def _date_range(days: int = 28) -> tuple[str, str]:
    end = dt.date.today()
    start = end - dt.timedelta(days=max(1, min(days, 90)))
    return start.isoformat(), end.isoformat()


def _find_landing_match(db: Session, query_text: str, cluster: str) -> str | None:
    from app.models.seo_landing_page import SeoLandingPage

    normalized = query_text.strip().casefold()
    if not normalized:
        return None

    kinds = LANDING_KIND_BY_CLUSTER.get(cluster)
    query = db.query(SeoLandingPage).filter(SeoLandingPage.is_active.is_(True))
    if kinds:
        query = query.filter(SeoLandingPage.kind.in_(kinds))

    for row in query.all():
        candidates = [
            row.title_ru,
            row.search_query,
            row.brand_name,
            row.city,
            row.slug,
        ]
        for candidate in candidates:
            if candidate and normalized in str(candidate).casefold():
                if row.kind == "brand_new":
                    return f"/autoparts/new/brand/{row.slug}"
                if row.kind == "brand_used":
                    return f"/autoparts/used/brand/{row.slug}"
                if row.kind == "category_new":
                    return f"/autoparts/new/category/{row.slug}"
                if row.kind == "category_used":
                    return f"/autoparts/used/category/{row.slug}"
                if row.kind == "geo":
                    return f"/autoparts/used/geo/{row.slug}"
    return None


def _recommend_action(
    *,
    cluster: str,
    matched_path: str | None,
    ctr: float,
    impressions: float,
) -> tuple[str, str]:
    if matched_path:
        if impressions >= 100 and ctr < 2.0 and cluster in {"B", "C", "D"}:
            return "improve_title", RECOMMENDATION_LABELS["improve_title"]
        return "covered", RECOMMENDATION_LABELS["covered"]
    if cluster in {"B", "C", "D"}:
        return "create_landing", RECOMMENDATION_LABELS["create_landing"]
    return "review", RECOMMENDATION_LABELS["review"]


def _build_item(db: Session, row: dict[str, Any], site_origin: str, sort_order: int) -> AnalyticsQueryReviewItem:
    query_text = str(row.get("query") or "").strip()
    cluster = classify_query_cluster(query_text)
    impressions = float(row.get("impressions") or 0)
    clicks = float(row.get("clicks") or 0)
    ctr = float(row.get("ctr") or 0)
    position = float(row.get("position") or 0)

    matched_path = _find_landing_match(db, query_text, cluster)
    if not matched_path:
        resolved = resolve_search_query(db, query_text, site_origin=site_origin)
        redirect_path = resolved.redirect_path or ""
        if resolved.status == "redirect" and redirect_path.startswith("/"):
            matched_path = redirect_path.split("?", 1)[0]
        elif resolved.status == "fallback" and "q=" in redirect_path:
            matched_path = None

    recommendation, recommendation_label = _recommend_action(
        cluster=cluster,
        matched_path=matched_path,
        ctr=ctr,
        impressions=impressions,
    )

    return AnalyticsQueryReviewItem(
        query_text=query_text[:512],
        cluster=cluster,
        impressions=int(impressions),
        clicks=int(clicks),
        ctr=str(round(ctr, 2)),
        position=str(round(position, 1)),
        matched_path=matched_path,
        recommendation=recommendation,
        recommendation_label=recommendation_label,
        sort_order=sort_order,
    )


def run_query_review(db: Session, *, days: int = 28, limit: int = 50) -> AnalyticsQueryReviewSnapshotOut:
    start_date, end_date = _date_range(days)
    start = dt.date.fromisoformat(start_date)
    end = dt.date.fromisoformat(end_date)
    integration = get_or_create_yandex_integration(db)
    site_origin = (integration.host_url or "https://svoygarage.ru").rstrip("/")

    snapshot = AnalyticsQueryReviewSnapshot(
        period_start=start,
        period_end=end,
        source="yandex_webmaster",
        status="ok",
        created_at=dt.datetime.now(dt.timezone.utc),
    )
    db.add(snapshot)
    db.flush()

    try:
        if not integration.access_token_encrypted or not integration.host_id:
            raise YandexApiError("OAuth Яндекса или host_id не подключены")

        token = get_valid_access_token(db, integration)
        user_payload = get_user(token)
        user_id = int(user_payload.get("user_id"))
        popular = get_popular_search_queries(
            user_id,
            integration.host_id,
            token,
            date_from=start_date,
            date_to=end_date,
            limit=max(1, min(limit, 500)),
        )
        rows = sorted(
            _normalize_yandex_rows(popular),
            key=lambda item: item["impressions"],
            reverse=True,
        )[:limit]

        for index, row in enumerate(rows):
            item = _build_item(db, row, site_origin, index)
            item.snapshot_id = snapshot.id
            db.add(item)
    except YandexApiError as exc:
        snapshot.status = "error"
        snapshot.error_message = str(exc)
        db.commit()
        db.refresh(snapshot)
        return _snapshot_to_out(snapshot, [])

    db.commit()
    db.refresh(snapshot)
    items = (
        db.query(AnalyticsQueryReviewItem)
        .filter(AnalyticsQueryReviewItem.snapshot_id == snapshot.id)
        .order_by(AnalyticsQueryReviewItem.sort_order.asc())
        .all()
    )
    return _snapshot_to_out(snapshot, items)


def get_latest_query_review(db: Session) -> AnalyticsQueryReviewSnapshotOut | None:
    snapshot = (
        db.query(AnalyticsQueryReviewSnapshot)
        .order_by(AnalyticsQueryReviewSnapshot.created_at.desc())
        .first()
    )
    if snapshot is None:
        return None
    items = (
        db.query(AnalyticsQueryReviewItem)
        .filter(AnalyticsQueryReviewItem.snapshot_id == snapshot.id)
        .order_by(AnalyticsQueryReviewItem.sort_order.asc())
        .all()
    )
    return _snapshot_to_out(snapshot, items)


def _snapshot_to_out(
    snapshot: AnalyticsQueryReviewSnapshot,
    items: list[AnalyticsQueryReviewItem],
) -> AnalyticsQueryReviewSnapshotOut:
    return AnalyticsQueryReviewSnapshotOut(
        id=int(snapshot.id),
        created_at=snapshot.created_at,
        period_start=snapshot.period_start,
        period_end=snapshot.period_end,
        source=snapshot.source,
        status=snapshot.status,
        error_message=snapshot.error_message,
        items=[
            AnalyticsQueryReviewItemOut(
                query=item.query_text,
                cluster=item.cluster,
                impressions=float(item.impressions),
                clicks=float(item.clicks),
                ctr=float(item.ctr or 0),
                position=float(item.position or 0),
                matched_path=item.matched_path,
                recommendation=item.recommendation,
                recommendation_label=item.recommendation_label,
            )
            for item in items
        ],
    )
