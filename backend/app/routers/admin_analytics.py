from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.site_analytics import (
    AnalyticsActivityOut,
    AnalyticsFormsOut,
    AnalyticsPageDetailOut,
    AnalyticsPagesOut,
    AnalyticsProductCardsOut,
    AnalyticsSummaryOut,
)
from app.services.site_analytics_service import (
    get_activity,
    get_forms,
    get_page_detail,
    get_pages,
    get_product_cards,
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


@router.get("/page-detail", response_model=AnalyticsPageDetailOut)
def analytics_page_detail(
    path_template: str = Query(..., min_length=1, max_length=512),
    days: int = Query(7, ge=1, le=365),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    validate_days(days)
    return get_page_detail(db, path_template, days)


@router.get("/product-cards", response_model=AnalyticsProductCardsOut)
def analytics_product_cards(
    days: int = Query(7, ge=1, le=365),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    validate_days(days)
    return get_product_cards(db, days, limit=limit)
