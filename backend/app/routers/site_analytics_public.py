from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.auth import get_current_user_optional
from app.db.database import get_db
from app.models.user import User
from app.schemas.site_analytics import AnalyticsEventsBatchIn
from app.services.site_analytics_service import ingest_events

router = APIRouter(tags=["Site analytics"])


@router.post("/public/analytics/events", status_code=204)
def ingest_analytics_events(
    payload: AnalyticsEventsBatchIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    # Rate limit: Redis middleware (120 req/min per IP).
    user_id = current_user.id if current_user else None
    ingest_events(db, payload.events, user_id=user_id)
    return None
