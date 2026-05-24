from __future__ import annotations

import time
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.auth import get_current_user_optional
from app.db.database import get_db
from app.models.user import User
from app.schemas.site_analytics import AnalyticsEventsBatchIn
from app.services.site_analytics_service import ingest_events

router = APIRouter(tags=["Site analytics"])

_RATE_WINDOW_SEC = 60
_RATE_MAX_REQUESTS = 120
_rate_buckets: dict[str, list[float]] = defaultdict(list)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _check_rate_limit(ip: str) -> bool:
    now = time.time()
    bucket = _rate_buckets[ip]
    _rate_buckets[ip] = [ts for ts in bucket if now - ts < _RATE_WINDOW_SEC]
    if len(_rate_buckets[ip]) >= _RATE_MAX_REQUESTS:
        return False
    _rate_buckets[ip].append(now)
    return True


@router.post("/public/analytics/events", status_code=204)
def ingest_analytics_events(
    payload: AnalyticsEventsBatchIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    ip = _client_ip(request)
    if not _check_rate_limit(ip):
        return None

    user_id = current_user.id if current_user else None
    ingest_events(db, payload.events, user_id=user_id)
    return None
