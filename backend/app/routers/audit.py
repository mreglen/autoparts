from __future__ import annotations

import math
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.user import User as UserModel
from app.schemas.audit import (
    AuditEventRow,
    AuditEventsResponse,
    AuditFiltersMetaResponse,
    AuditFilterOption,
    AuditOrgOption,
    AuditOrgOptionsResponse,
    AuditSearchHint,
    AuditSearchHintsResponse,
    AuditUserOption,
    AuditUserOptionsResponse,
)
from app.services.audit_service import (
    AuditListFilters,
    events_to_dicts,
    event_to_dict,
    get_audit_event,
    get_audit_filter_options,
    list_audit_events,
    require_audit_access,
    resolve_user_ids_for_filter,
    search_audit_hints,
    search_organizations,
    search_users_for_audit,
)

router = APIRouter(prefix="/audit", tags=["Audit"])


def _require_audit_access(db: Session, user: UserModel) -> None:
    require_audit_access(db, user)


@router.get("/events", response_model=AuditEventsResponse)
def get_audit_events(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    category: str | None = Query(None),
    event_type: str | None = Query(None),
    organization_id: str | None = Query(None),
    user_id: int | None = Query(None),
    user: str | None = Query(None, description="public_code, internal id, email or name"),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_audit_access(db, current_user)
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=400, detail="date_from не может быть позже date_to")

    user_ids = None
    resolved_user_id = user_id
    if user and user.strip():
        user_ids = resolve_user_ids_for_filter(db, user)
        if user_ids == []:
            return AuditEventsResponse(rows=[], total=0, page=page, limit=limit, pages=0)
        if len(user_ids) == 1:
            resolved_user_id = user_ids[0]
            user_ids = None
        else:
            resolved_user_id = None

    filters = AuditListFilters(
        date_from=date_from,
        date_to=date_to,
        category=(category or "").strip().lower() or None,
        event_type=(event_type or "").strip() or None,
        organization_id=(organization_id or "").strip() or None,
        user_id=resolved_user_id,
        user_ids=tuple(user_ids) if user_ids and len(user_ids) > 1 else None,
        search=(search or "").strip() or None,
    )
    rows, total = list_audit_events(db, filters, page=page, limit=limit)
    pages = math.ceil(total / limit) if total else 0
    return AuditEventsResponse(
        rows=[AuditEventRow(**d) for d in events_to_dicts(db, rows)],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.get("/events/{event_id}", response_model=AuditEventRow)
def get_audit_event_detail(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_audit_access(db, current_user)
    row = get_audit_event(db, event_id)
    if not row:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    enriched = events_to_dicts(db, [row])
    return AuditEventRow(**enriched[0])


@router.get("/meta/filters", response_model=AuditFiltersMetaResponse)
def get_audit_filters_meta(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_audit_access(db, current_user)
    meta = get_audit_filter_options(db)
    return AuditFiltersMetaResponse(
        categories=[AuditFilterOption(**c) for c in meta["categories"]],
        event_types=[AuditFilterOption(**t) for t in meta["event_types"]],
        category_labels=meta["category_labels"],
        event_type_labels=meta["event_type_labels"],
    )


@router.get("/meta/organizations", response_model=AuditOrgOptionsResponse)
def get_audit_organization_options(
    q: str = Query("", max_length=200),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_audit_access(db, current_user)
    items = [AuditOrgOption(**o) for o in search_organizations(db, q, limit=limit)]
    return AuditOrgOptionsResponse(items=items)


@router.get("/meta/users", response_model=AuditUserOptionsResponse)
def get_audit_user_options(
    q: str = Query("", max_length=200),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_audit_access(db, current_user)
    items = [AuditUserOption(**u) for u in search_users_for_audit(db, q, limit=limit)]
    return AuditUserOptionsResponse(items=items)


@router.get("/meta/search-hints", response_model=AuditSearchHintsResponse)
def get_audit_search_hints(
    q: str = Query("", max_length=200),
    limit: int = Query(10, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_audit_access(db, current_user)
    items = [AuditSearchHint(**h) for h in search_audit_hints(db, q, limit=limit)]
    return AuditSearchHintsResponse(items=items)
