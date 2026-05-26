from __future__ import annotations

import re
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Iterable, Optional

from fastapi import HTTPException, status
from sqlalchemy import bindparam, func, text
from sqlalchemy.orm import Session

from app.models.site_analytics import (
    SiteAnalyticsFormEvent,
    SiteAnalyticsPageView,
    SiteAnalyticsSession,
)
from app.schemas.site_analytics import (
    AnalyticsActivityOut,
    AnalyticsActivityRowOut,
    AnalyticsEventIn,
    AnalyticsFormRowOut,
    AnalyticsFormsOut,
    AnalyticsPageDetailOut,
    AnalyticsPageInstanceRowOut,
    AnalyticsPageRowOut,
    AnalyticsPagesOut,
    AnalyticsProductCardRowOut,
    AnalyticsProductCardsOut,
    AnalyticsSummaryOut,
)

SENSITIVE_FIELD_NAMES = frozenset(
    {
        "password",
        "password_repeat",
        "hashed_password",
        "token",
        "secret",
        "code",
        "verification_code",
        "client_secret",
    }
)

PRODUCT_CARD_PATH_RE = re.compile(r"^/part/(\d+)(?:-|$)")

PATH_NORMALIZATION_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"^/part/[^/]+$"), "/part/:productId"),
    (re.compile(r"^/chats/[^/]+$"), "/chats/:chatId"),
    (re.compile(r"^/my-parts/edit/\d+$"), "/my-parts/edit/:id"),
    (re.compile(r"^/my-parts/resubmit/\d+$"), "/my-parts/resubmit/:id"),
    (re.compile(r"^/my-parts/edit-pending/\d+$"), "/my-parts/edit-pending/:id"),
    (re.compile(r"^/seller/part-card/\d+$"), "/seller/part-card/:id"),
    (re.compile(r"^/seller/[A-Z]\d{6}$"), "/seller/:publicCode"),
    (re.compile(r"^/buyer/[A-Z]\d{6}$"), "/buyer/:publicCode"),
    (re.compile(r"^/users/[A-Za-z0-9]{1,10}$"), "/users/:publicCode"),
    (re.compile(r"^/vehicles/edit/\d+$"), "/vehicles/edit/:id"),
    (re.compile(r"^/sellers/[^/]+/workspace$"), "/sellers/:sellerId/workspace"),
    (re.compile(r"^/moderation/products/[^/]+$"), "/moderation/products/:organizationId"),
]


def extract_product_id_from_path(path: str) -> Optional[int]:
    raw = (path or "").split("?")[0].strip()
    match = PRODUCT_CARD_PATH_RE.match(raw)
    if not match:
        return None
    try:
        return int(match.group(1))
    except ValueError:
        return None


def normalize_path(path: str) -> tuple[str, str]:
    raw = (path or "/").split("?")[0].strip() or "/"
    if len(raw) > 2048:
        raw = raw[:2048]
    template = raw
    for pattern, replacement in PATH_NORMALIZATION_RULES:
        if pattern.match(raw):
            template = replacement
            break
    return template, raw


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _period_start(days: int) -> datetime:
    return _utcnow() - timedelta(days=max(1, min(days, 365)))


def _today_start() -> datetime:
    now = _utcnow()
    return datetime(now.year, now.month, now.day, tzinfo=timezone.utc)


def _sanitize_field_name(field_name: Optional[str]) -> Optional[str]:
    if not field_name:
        return None
    normalized = field_name.strip().lower()
    if not normalized or normalized in SENSITIVE_FIELD_NAMES:
        return None
    return field_name.strip()[:128]


def _get_or_create_session(
    db: Session,
    visitor_id: str,
    user_id: Optional[int],
) -> SiteAnalyticsSession:
    session = (
        db.query(SiteAnalyticsSession)
        .filter(SiteAnalyticsSession.visitor_id == visitor_id)
        .order_by(SiteAnalyticsSession.last_seen_at.desc())
        .first()
    )
    now = _utcnow()
    if session is None:
        session = SiteAnalyticsSession(
            visitor_id=visitor_id,
            user_id=user_id,
            started_at=now,
            last_seen_at=now,
        )
        db.add(session)
        db.flush()
        return session

    session.last_seen_at = now
    if user_id and not session.user_id:
        session.user_id = user_id
    return session


def _find_open_page_view(
    db: Session,
    session_id: int,
    client_view_id: Optional[str],
) -> Optional[SiteAnalyticsPageView]:
    query = db.query(SiteAnalyticsPageView).filter(
        SiteAnalyticsPageView.session_id == session_id,
        SiteAnalyticsPageView.duration_sec == 0,
    )
    if client_view_id:
        query = query.filter(SiteAnalyticsPageView.client_view_id == client_view_id)
    return query.order_by(SiteAnalyticsPageView.entered_at.desc()).first()


def _apply_duration(page_view: SiteAnalyticsPageView, duration_sec: Optional[int]) -> None:
    if duration_sec is None:
        return
    page_view.duration_sec = max(page_view.duration_sec, int(duration_sec))


def ingest_events(
    db: Session,
    events: Iterable[AnalyticsEventIn],
    user_id: Optional[int],
) -> None:
    session_cache: dict[str, SiteAnalyticsSession] = {}

    for event in events:
        visitor_id = event.visitor_id.strip()
        if not visitor_id:
            continue

        if visitor_id not in session_cache:
            session_cache[visitor_id] = _get_or_create_session(db, visitor_id, user_id)
        session = session_cache[visitor_id]
        now = _utcnow()
        session.last_seen_at = now

        if event.type == "page_view":
            path = event.path or "/"
            path_template, path_raw = normalize_path(path)

            if event.duration_sec and event.view_id:
                previous = _find_open_page_view(db, session.id, event.view_id)
                if previous:
                    _apply_duration(previous, event.duration_sec)
                    session.duration_sec += int(event.duration_sec)

            page_view = SiteAnalyticsPageView(
                session_id=session.id,
                client_view_id=event.view_id,
                path_template=path_template,
                path_raw=path_raw,
                entered_at=now,
            )
            db.add(page_view)
            session.page_views_count += 1
            continue

        if event.type == "heartbeat":
            increment = int(event.duration_sec or 0)
            if increment > 0:
                session.duration_sec += increment
                if event.view_id:
                    current = _find_open_page_view(db, session.id, event.view_id)
                    if current:
                        _apply_duration(current, increment)
            continue

        if event.type == "form_field":
            form_id = (event.form_id or "").strip()
            field_name = _sanitize_field_name(event.field_name)
            if not form_id or not field_name:
                continue
            db.add(
                SiteAnalyticsFormEvent(
                    session_id=session.id,
                    form_id=form_id[:64],
                    field_name=field_name,
                    event_type="field_filled",
                    created_at=now,
                )
            )
            continue

        if event.type == "form_submit":
            form_id = (event.form_id or "").strip()
            if not form_id:
                continue
            filled_fields = event.filled_fields or []
            if filled_fields:
                seen = set()
                for raw_name in filled_fields:
                    field_name = _sanitize_field_name(raw_name)
                    if not field_name or field_name in seen:
                        continue
                    seen.add(field_name)
                    db.add(
                        SiteAnalyticsFormEvent(
                            session_id=session.id,
                            form_id=form_id[:64],
                            field_name=field_name,
                            event_type="form_submit",
                            created_at=now,
                        )
                    )
            else:
                db.add(
                    SiteAnalyticsFormEvent(
                        session_id=session.id,
                        form_id=form_id[:64],
                        field_name=None,
                        event_type="form_submit",
                        created_at=now,
                    )
                )

    db.commit()


def get_summary(db: Session, days: int) -> AnalyticsSummaryOut:
    since = _period_start(days)
    page_views = (
        db.query(func.count(SiteAnalyticsPageView.id))
        .filter(SiteAnalyticsPageView.entered_at >= since)
        .scalar()
        or 0
    )
    unique_visitors = (
        db.query(func.count(func.distinct(SiteAnalyticsSession.visitor_id)))
        .join(
            SiteAnalyticsPageView,
            SiteAnalyticsPageView.session_id == SiteAnalyticsSession.id,
        )
        .filter(SiteAnalyticsPageView.entered_at >= since)
        .scalar()
        or 0
    )
    avg_duration = (
        db.query(func.avg(SiteAnalyticsSession.duration_sec))
        .filter(SiteAnalyticsSession.last_seen_at >= since)
        .scalar()
        or 0
    )
    active_today = (
        db.query(func.count(func.distinct(SiteAnalyticsSession.visitor_id)))
        .filter(SiteAnalyticsSession.last_seen_at >= _today_start())
        .scalar()
        or 0
    )
    return AnalyticsSummaryOut(
        days=days,
        page_views=int(page_views),
        unique_visitors=int(unique_visitors),
        avg_session_duration_sec=round(float(avg_duration), 1),
        active_today=int(active_today),
    )


def get_pages(db: Session, days: int) -> AnalyticsPagesOut:
    since = _period_start(days)
    rows = (
        db.query(
            SiteAnalyticsPageView.path_template,
            func.count(SiteAnalyticsPageView.id).label("views"),
            func.count(func.distinct(SiteAnalyticsSession.visitor_id)).label("unique_visitors"),
            func.avg(SiteAnalyticsPageView.duration_sec).label("avg_duration_sec"),
        )
        .join(
            SiteAnalyticsSession,
            SiteAnalyticsSession.id == SiteAnalyticsPageView.session_id,
        )
        .filter(SiteAnalyticsPageView.entered_at >= since)
        .group_by(SiteAnalyticsPageView.path_template)
        .order_by(func.count(SiteAnalyticsPageView.id).desc())
        .limit(100)
        .all()
    )
    items = [
        AnalyticsPageRowOut(
            path_template=row.path_template,
            views=int(row.views),
            unique_visitors=int(row.unique_visitors),
            avg_duration_sec=round(float(row.avg_duration_sec or 0), 1),
        )
        for row in rows
    ]
    return AnalyticsPagesOut(days=days, items=items)


def get_forms(db: Session, days: int) -> AnalyticsFormsOut:
    since = _period_start(days)
    rows = (
        db.query(
            SiteAnalyticsFormEvent.form_id,
            SiteAnalyticsFormEvent.field_name,
            SiteAnalyticsFormEvent.event_type,
            func.count(SiteAnalyticsFormEvent.id).label("cnt"),
        )
        .filter(SiteAnalyticsFormEvent.created_at >= since)
        .group_by(
            SiteAnalyticsFormEvent.form_id,
            SiteAnalyticsFormEvent.field_name,
            SiteAnalyticsFormEvent.event_type,
        )
        .all()
    )

    aggregated: dict[tuple[str, Optional[str]], dict[str, int]] = defaultdict(
        lambda: {"fill_count": 0, "submit_count": 0}
    )
    for row in rows:
        key = (row.form_id, row.field_name)
        if row.event_type == "field_filled":
            aggregated[key]["fill_count"] += int(row.cnt)
        elif row.event_type == "form_submit":
            aggregated[key]["submit_count"] += int(row.cnt)

    items = [
        AnalyticsFormRowOut(
            form_id=form_id,
            field_name=field_name,
            fill_count=counts["fill_count"],
            submit_count=counts["submit_count"],
        )
        for (form_id, field_name), counts in sorted(
            aggregated.items(),
            key=lambda item: (item[1]["fill_count"] + item[1]["submit_count"]),
            reverse=True,
        )
    ]
    return AnalyticsFormsOut(days=days, items=items)


def get_activity(db: Session, days: int) -> AnalyticsActivityOut:
    since = _period_start(days)
    view_rows = (
        db.query(
            func.date(SiteAnalyticsPageView.entered_at).label("day"),
            func.count(SiteAnalyticsPageView.id).label("page_views"),
            func.count(func.distinct(SiteAnalyticsSession.visitor_id)).label("unique_visitors"),
        )
        .join(
            SiteAnalyticsSession,
            SiteAnalyticsSession.id == SiteAnalyticsPageView.session_id,
        )
        .filter(SiteAnalyticsPageView.entered_at >= since)
        .group_by(func.date(SiteAnalyticsPageView.entered_at))
        .order_by(func.date(SiteAnalyticsPageView.entered_at).desc())
        .all()
    )
    items = [
        AnalyticsActivityRowOut(
            day=row.day if isinstance(row.day, date) else datetime.fromisoformat(str(row.day)).date(),
            page_views=int(row.page_views),
            unique_visitors=int(row.unique_visitors),
        )
        for row in view_rows
    ]
    return AnalyticsActivityOut(days=days, items=items)


def get_page_detail(db: Session, path_template: str, days: int) -> AnalyticsPageDetailOut:
    since = _period_start(days)
    path_template = path_template.strip() or "/"

    page_views = (
        db.query(func.count(SiteAnalyticsPageView.id))
        .join(
            SiteAnalyticsSession,
            SiteAnalyticsSession.id == SiteAnalyticsPageView.session_id,
        )
        .filter(
            SiteAnalyticsPageView.path_template == path_template,
            SiteAnalyticsPageView.entered_at >= since,
        )
        .scalar()
        or 0
    )
    unique_visitors = (
        db.query(func.count(func.distinct(SiteAnalyticsSession.visitor_id)))
        .join(
            SiteAnalyticsPageView,
            SiteAnalyticsPageView.session_id == SiteAnalyticsSession.id,
        )
        .filter(
            SiteAnalyticsPageView.path_template == path_template,
            SiteAnalyticsPageView.entered_at >= since,
        )
        .scalar()
        or 0
    )
    avg_duration = (
        db.query(func.avg(SiteAnalyticsPageView.duration_sec))
        .filter(
            SiteAnalyticsPageView.path_template == path_template,
            SiteAnalyticsPageView.entered_at >= since,
        )
        .scalar()
        or 0
    )

    activity_rows = (
        db.query(
            func.date(SiteAnalyticsPageView.entered_at).label("day"),
            func.count(SiteAnalyticsPageView.id).label("page_views"),
            func.count(func.distinct(SiteAnalyticsSession.visitor_id)).label("unique_visitors"),
        )
        .join(
            SiteAnalyticsSession,
            SiteAnalyticsSession.id == SiteAnalyticsPageView.session_id,
        )
        .filter(
            SiteAnalyticsPageView.path_template == path_template,
            SiteAnalyticsPageView.entered_at >= since,
        )
        .group_by(func.date(SiteAnalyticsPageView.entered_at))
        .order_by(func.date(SiteAnalyticsPageView.entered_at).desc())
        .all()
    )
    activity = [
        AnalyticsActivityRowOut(
            day=row.day if isinstance(row.day, date) else datetime.fromisoformat(str(row.day)).date(),
            page_views=int(row.page_views),
            unique_visitors=int(row.unique_visitors),
        )
        for row in activity_rows
    ]

    instances: list[AnalyticsPageInstanceRowOut] = []
    instance_rows = (
        db.query(
            SiteAnalyticsPageView.path_raw,
            func.count(SiteAnalyticsPageView.id).label("views"),
            func.count(func.distinct(SiteAnalyticsSession.visitor_id)).label("unique_visitors"),
            func.avg(SiteAnalyticsPageView.duration_sec).label("avg_duration_sec"),
        )
        .join(
            SiteAnalyticsSession,
            SiteAnalyticsSession.id == SiteAnalyticsPageView.session_id,
        )
        .filter(
            SiteAnalyticsPageView.path_template == path_template,
            SiteAnalyticsPageView.entered_at >= since,
        )
        .group_by(SiteAnalyticsPageView.path_raw)
        .order_by(func.count(SiteAnalyticsPageView.id).desc())
        .limit(50)
        .all()
    )
    if len(instance_rows) > 1 or path_template == "/part/:productId":
        instances = [
            AnalyticsPageInstanceRowOut(
                path_raw=row.path_raw,
                views=int(row.views),
                unique_visitors=int(row.unique_visitors),
                avg_duration_sec=round(float(row.avg_duration_sec or 0), 1),
            )
            for row in instance_rows
        ]

    return AnalyticsPageDetailOut(
        days=days,
        path_template=path_template,
        page_views=int(page_views),
        unique_visitors=int(unique_visitors),
        avg_duration_sec=round(float(avg_duration), 1),
        activity=activity,
        instances=instances,
    )


def get_product_cards(db: Session, days: int, limit: int = 100) -> AnalyticsProductCardsOut:
    since = _period_start(days)
    path_template = "/part/:productId"

    instance_rows = (
        db.query(
            SiteAnalyticsPageView.path_raw,
            func.count(SiteAnalyticsPageView.id).label("views"),
            func.count(func.distinct(SiteAnalyticsSession.visitor_id)).label("unique_visitors"),
            func.avg(SiteAnalyticsPageView.duration_sec).label("avg_duration_sec"),
        )
        .join(
            SiteAnalyticsSession,
            SiteAnalyticsSession.id == SiteAnalyticsPageView.session_id,
        )
        .filter(
            SiteAnalyticsPageView.path_template == path_template,
            SiteAnalyticsPageView.entered_at >= since,
        )
        .group_by(SiteAnalyticsPageView.path_raw)
        .order_by(func.count(SiteAnalyticsPageView.id).desc())
        .limit(max(1, min(limit, 500)))
        .all()
    )

    product_ids: list[int] = []
    parsed_rows: list[tuple] = []
    for row in instance_rows:
        product_id = extract_product_id_from_path(row.path_raw)
        if product_id:
            product_ids.append(product_id)
        parsed_rows.append((row, product_id))

    products_by_id: dict[int, dict] = {}
    unique_ids = list(set(product_ids))
    if unique_ids:
        stmt = text(
            "SELECT id, brand, article, name FROM products WHERE id IN :ids"
        ).bindparams(bindparam("ids", expanding=True))
        product_rows = db.execute(stmt, {"ids": unique_ids}).fetchall()
        products_by_id = {
            int(product_row.id): {
                "brand": product_row.brand,
                "article": product_row.article,
                "name": product_row.name,
            }
            for product_row in product_rows
        }

    items: list[AnalyticsProductCardRowOut] = []
    total_views = 0
    for row, product_id in parsed_rows:
        views = int(row.views)
        total_views += views
        product = products_by_id.get(product_id) if product_id else None
        items.append(
            AnalyticsProductCardRowOut(
                product_id=product_id,
                path_raw=row.path_raw,
                brand=product.get("brand") if product else None,
                article=product.get("article") if product else None,
                name=product.get("name") if product else None,
                views=views,
                unique_visitors=int(row.unique_visitors),
                avg_duration_sec=round(float(row.avg_duration_sec or 0), 1),
            )
        )

    summary_views = (
        db.query(func.count(SiteAnalyticsPageView.id))
        .filter(
            SiteAnalyticsPageView.path_template == path_template,
            SiteAnalyticsPageView.entered_at >= since,
        )
        .scalar()
        or 0
    )

    return AnalyticsProductCardsOut(
        days=days,
        total_views=int(summary_views),
        unique_cards=len(items),
        items=items,
    )


def validate_days(days: int) -> int:
    if days < 1 or days > 365:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="days must be between 1 and 365",
        )
    return days
