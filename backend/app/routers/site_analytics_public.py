from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends
from jose import jwt
from sqlalchemy.orm import Session

from app.core.auth import get_user_by_email, oauth2_scheme_optional
from app.core.config import Settings
from app.db.database import SessionLocal, get_db
from app.schemas.site_analytics import AnalyticsEventIn, AnalyticsEventsBatchIn
from app.services.site_analytics_service import ingest_events

logger = logging.getLogger(__name__)
settings = Settings()
router = APIRouter(tags=["Site analytics"])


def _resolve_user_id_for_analytics(token: Optional[str], db: Session) -> Optional[int]:
    """User id for analytics without session last_activity update."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email = payload.get("sub")
        if not email:
            return None
        user = get_user_by_email(db, email)
        return user.id if user else None
    except Exception:
        return None


def _persist_analytics_events(events: list[AnalyticsEventIn], user_id: Optional[int]) -> None:
    db = SessionLocal()
    try:
        ingest_events(db, events, user_id=user_id)
    except Exception:
        logger.exception("analytics ingest failed (%s events)", len(events))
    finally:
        db.close()


@router.post("/public/analytics/events", status_code=204)
def ingest_analytics_events(
    payload: AnalyticsEventsBatchIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme_optional),
):
    # Rate limit: Redis middleware (120 req/min per IP).
    user_id = _resolve_user_id_for_analytics(token, db)
    background_tasks.add_task(_persist_analytics_events, list(payload.events), user_id)
    return None
