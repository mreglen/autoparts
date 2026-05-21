from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import date, datetime, time, timezone
from typing import Any, Optional

from sqlalchemy import func, or_, cast, String
from sqlalchemy.orm import Session

from app.models.event_log import EventLog
from app.models.organization import Organization
from app.models.permission import Permission
from app.models.user import User as UserModel
from app.models.user_permission import UserPermission
from app.services.audit_event_catalog import CATEGORY_LABELS, EVENT_TYPE_LABELS
from app.utils.org_access import ADMIN_AUDIT_PERMISSION_CODE


def has_audit_access(db: Session, user: UserModel) -> bool:
    if user.is_admin:
        return True
    if not user.is_employee:
        return False
    q = (
        db.query(Permission.code)
        .join(UserPermission, UserPermission.permission_id == Permission.id)
        .filter(UserPermission.user_id == user.id, Permission.code == ADMIN_AUDIT_PERMISSION_CODE)
    )
    return db.query(q.exists()).scalar() is True


def require_audit_access(db: Session, user: UserModel) -> None:
    from fastapi import HTTPException, status

    if not has_audit_access(db, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нет доступа к журналу событий",
        )

logger = logging.getLogger(__name__)


def _actor_display_name(user: UserModel | None) -> Optional[str]:
    if not user:
        return None
    parts = [user.last_name, user.first_name, user.patronymic]
    name = " ".join(p for p in parts if p).strip()
    return name or user.email


def log_audit(
    db: Session,
    *,
    event_type: str,
    category: str,
    summary: str,
    user: UserModel | None = None,
    user_id: int | None = None,
    email: str | None = None,
    actor_name: str | None = None,
    organization_id: str | None = None,
    details: dict | None = None,
    entity_type: str | None = None,
    entity_id: str | int | None = None,
    ip: str | None = None,
    commit: bool = True,
) -> EventLog:
    """Append an audit event. Uses a separate commit by default (safe for mixed transactions)."""
    resolved_user_id = user_id if user_id is not None else (user.id if user else None)
    resolved_email = email or (user.email if user else None)
    resolved_actor = actor_name or _actor_display_name(user)

    entry = EventLog(
        event_type=event_type,
        category=category,
        summary=(summary or "")[:500],
        user_id=resolved_user_id,
        email=resolved_email,
        actor_name=resolved_actor,
        organization_id=organization_id,
        details=json.dumps(details, ensure_ascii=False) if details else None,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        ip_address=ip,
    )
    db.add(entry)
    try:
        if commit:
            db.commit()
            db.refresh(entry)
        else:
            db.flush()
    except Exception:
        db.rollback()
        logger.exception("Failed to write audit log: %s", event_type)
        raise
    return entry


@dataclass(frozen=True)
class AuditListFilters:
    date_from: date | None = None
    date_to: date | None = None
    category: str | None = None
    event_type: str | None = None
    organization_id: str | None = None
    user_id: int | None = None
    user_ids: tuple[int, ...] | None = None
    search: str | None = None


def _user_display_name(user: UserModel) -> str:
    parts = [user.last_name, user.first_name, user.patronymic]
    name = " ".join(p for p in parts if p).strip()
    return name or (user.email or "")


def resolve_user_ids_for_filter(db: Session, query: str) -> list[int] | None:
    """Resolve public_code, internal id, email, or FIO to user id list. None = no user filter."""
    q = (query or "").strip()
    if not q:
        return None

    by_code = db.query(UserModel.id).filter(UserModel.public_code == q).all()
    if by_code:
        return [r[0] for r in by_code]

    if q.isdigit():
        internal_id = int(q)
        row = db.query(UserModel.id).filter(UserModel.id == internal_id).first()
        if row:
            return [row[0]]

    term = f"%{q}%"
    rows = (
        db.query(UserModel.id)
        .filter(
            or_(
                UserModel.email.ilike(term),
                UserModel.last_name.ilike(term),
                UserModel.first_name.ilike(term),
                UserModel.patronymic.ilike(term),
                UserModel.public_code.ilike(term),
                cast(UserModel.id, String).ilike(term),
            )
        )
        .limit(50)
        .all()
    )
    if rows:
        return [r[0] for r in rows]

    actor_rows = (
        db.query(EventLog.user_id)
        .filter(EventLog.actor_name.ilike(term), EventLog.user_id.isnot(None))
        .distinct()
        .limit(50)
        .all()
    )
    if actor_rows:
        return [r[0] for r in actor_rows if r[0] is not None]

    return []


def search_organizations(db: Session, q: str, *, limit: int = 20) -> list[dict[str, Any]]:
    term = (q or "").strip()
    query = db.query(Organization.id, Organization.name)
    if term:
        like = f"%{term}%"
        query = query.filter(or_(Organization.id.ilike(like), Organization.name.ilike(like)))
    rows = query.order_by(Organization.name.asc(), Organization.id.asc()).limit(limit).all()
    return [{"id": r[0], "name": r[1]} for r in rows]


def search_users_for_audit(db: Session, q: str, *, limit: int = 20) -> list[dict[str, Any]]:
    term = (q or "").strip()
    query = db.query(UserModel)
    if term:
        like = f"%{term}%"
        query = query.filter(
            or_(
                UserModel.public_code.ilike(like),
                UserModel.email.ilike(like),
                UserModel.last_name.ilike(like),
                UserModel.first_name.ilike(like),
                UserModel.patronymic.ilike(like),
                cast(UserModel.id, String).ilike(like),
            )
        )
    users = query.order_by(UserModel.last_name.asc(), UserModel.first_name.asc()).limit(limit).all()
    return [
        {
            "id": u.id,
            "public_code": u.public_code,
            "display_name": _user_display_name(u),
            "email": u.email,
        }
        for u in users
    ]


def search_audit_hints(db: Session, q: str, *, limit: int = 10) -> list[dict[str, Any]]:
    term = (q or "").strip()
    if len(term) < 1:
        return []

    like = f"%{term}%"
    hints: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(value: str, hint_type: str, label: str | None = None) -> None:
        key = f"{hint_type}:{value}"
        if not value or key in seen:
            return
        seen.add(key)
        hints.append({"value": value, "hint_type": hint_type, "label": label or value})

    for row in (
        db.query(EventLog.summary)
        .filter(EventLog.summary.isnot(None), EventLog.summary.ilike(like))
        .distinct()
        .order_by(EventLog.summary.asc())
        .limit(limit)
        .all()
    ):
        add(row[0], "summary")
        if len(hints) >= limit:
            break

    for row in (
        db.query(EventLog.email)
        .filter(EventLog.email.isnot(None), EventLog.email.ilike(like))
        .distinct()
        .limit(max(0, limit - len(hints)))
        .all()
    ):
        add(row[0], "email")
        if len(hints) >= limit:
            break

    for row in (
        db.query(EventLog.actor_name)
        .filter(EventLog.actor_name.isnot(None), EventLog.actor_name.ilike(like))
        .distinct()
        .limit(max(0, limit - len(hints)))
        .all()
    ):
        add(row[0], "actor")
        if len(hints) >= limit:
            break

    for code, label in EVENT_TYPE_LABELS.items():
        if term.lower() in code.lower() or term.lower() in label.lower():
            add(code, "event_type", label)
            if len(hints) >= limit:
                break

    return hints[:limit]


def _apply_filters(q, filters: AuditListFilters):
    if filters.date_from:
        start = datetime.combine(filters.date_from, time.min, tzinfo=timezone.utc)
        q = q.filter(EventLog.created_at >= start)
    if filters.date_to:
        end = datetime.combine(filters.date_to, time.max, tzinfo=timezone.utc)
        q = q.filter(EventLog.created_at <= end)
    if filters.category:
        q = q.filter(EventLog.category == filters.category)
    if filters.event_type:
        q = q.filter(EventLog.event_type == filters.event_type)
    if filters.organization_id:
        q = q.filter(EventLog.organization_id == filters.organization_id)
    if filters.user_ids:
        q = q.filter(EventLog.user_id.in_(filters.user_ids))
    elif filters.user_id is not None:
        q = q.filter(EventLog.user_id == filters.user_id)
    if filters.search:
        term = f"%{filters.search.strip()}%"
        q = q.filter(
            or_(
                EventLog.summary.ilike(term),
                EventLog.email.ilike(term),
                EventLog.actor_name.ilike(term),
                EventLog.details.ilike(term),
                EventLog.event_type.ilike(term),
            )
        )
    return q


def list_audit_events(
    db: Session,
    filters: AuditListFilters,
    *,
    page: int = 1,
    limit: int = 50,
) -> tuple[list[EventLog], int]:
    page = max(1, page)
    limit = min(max(1, limit), 200)
    base = db.query(EventLog)
    base = _apply_filters(base, filters)
    total = base.with_entities(func.count(EventLog.id)).scalar() or 0
    rows = (
        base.order_by(EventLog.created_at.desc(), EventLog.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return rows, int(total)


def get_audit_event(db: Session, event_id: int) -> EventLog | None:
    return db.query(EventLog).filter(EventLog.id == event_id).first()


def get_audit_filter_options(db: Session) -> dict[str, Any]:
    categories = [
        row[0]
        for row in db.query(EventLog.category)
        .filter(EventLog.category.isnot(None))
        .distinct()
        .order_by(EventLog.category)
        .all()
    ]
    event_types = [
        row[0]
        for row in db.query(EventLog.event_type)
        .distinct()
        .order_by(EventLog.event_type)
        .all()
    ]
    return {
        "categories": [
            {"code": c, "label": CATEGORY_LABELS.get(c, c)} for c in categories
        ],
        "event_types": [
            {"code": t, "label": EVENT_TYPE_LABELS.get(t, t)} for t in event_types
        ],
        "category_labels": CATEGORY_LABELS,
        "event_type_labels": EVENT_TYPE_LABELS,
    }


def _enrichment_maps(db: Session, rows: list[EventLog]) -> tuple[dict[int, UserModel], dict[str, str]]:
    user_ids = {r.user_id for r in rows if r.user_id}
    org_ids = {r.organization_id for r in rows if r.organization_id}
    users_by_id: dict[int, UserModel] = {}
    org_names: dict[str, str] = {}
    if user_ids:
        for u in db.query(UserModel).filter(UserModel.id.in_(user_ids)).all():
            users_by_id[u.id] = u
    if org_ids:
        for o in db.query(Organization.id, Organization.name).filter(Organization.id.in_(org_ids)).all():
            org_names[o[0]] = o[1]
    return users_by_id, org_names


def event_to_dict(
    row: EventLog,
    *,
    users_by_id: dict[int, UserModel] | None = None,
    org_names: dict[str, str] | None = None,
) -> dict[str, Any]:
    details_parsed = None
    if row.details:
        try:
            details_parsed = json.loads(row.details)
        except json.JSONDecodeError:
            details_parsed = row.details

    user_public_code = None
    if row.user_id and users_by_id and row.user_id in users_by_id:
        user_public_code = users_by_id[row.user_id].public_code

    organization_name = None
    if row.organization_id and org_names:
        organization_name = org_names.get(row.organization_id)

    return {
        "id": row.id,
        "event_type": row.event_type,
        "event_type_label": EVENT_TYPE_LABELS.get(row.event_type, row.event_type),
        "category": row.category,
        "category_label": CATEGORY_LABELS.get(row.category, row.category) if row.category else None,
        "summary": row.summary,
        "user_id": row.user_id,
        "user_public_code": user_public_code,
        "email": row.email,
        "actor_name": row.actor_name,
        "organization_id": row.organization_id,
        "organization_name": organization_name,
        "entity_type": row.entity_type,
        "entity_id": row.entity_id,
        "ip_address": row.ip_address,
        "details": row.details,
        "details_parsed": details_parsed,
        "created_at": row.created_at,
    }


def events_to_dicts(db: Session, rows: list[EventLog]) -> list[dict[str, Any]]:
    users_by_id, org_names = _enrichment_maps(db, rows)
    return [event_to_dict(r, users_by_id=users_by_id, org_names=org_names) for r in rows]
