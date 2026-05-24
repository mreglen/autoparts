from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.site_analytics import (
    AnalyticsActivityOut,
    AnalyticsFormsOut,
    AnalyticsPagesOut,
    AnalyticsSummaryOut,
)
from app.services.site_analytics_service import (
    get_activity,
    get_forms,
    get_pages,
    get_summary,
    validate_days,
)

router = APIRouter(prefix="/admin/analytics", tags=["Admin analytics"])


@router.get("/summary", response_model=AnalyticsSummaryOut)
def analytics_summary(
    days: int = Query(7, ge=1, le=365),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    validate_days(days)
    return get_summary(db, days)


@router.get("/pages", response_model=AnalyticsPagesOut)
def analytics_pages(
    days: int = Query(7, ge=1, le=365),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    validate_days(days)
    return get_pages(db, days)


@router.get("/forms", response_model=AnalyticsFormsOut)
def analytics_forms(
    days: int = Query(7, ge=1, le=365),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    validate_days(days)
    return get_forms(db, days)


@router.get("/activity", response_model=AnalyticsActivityOut)
def analytics_activity(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    validate_days(days)
    return get_activity(db, days)
