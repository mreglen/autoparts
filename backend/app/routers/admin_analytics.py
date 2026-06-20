from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.site_analytics import (
    AnalyticsActivityOut,
    AnalyticsConversionTrendOut,
    AnalyticsFormsOut,
    AnalyticsFunnelOut,
    AnalyticsLandingsOut,
    AnalyticsPageDetailOut,
    AnalyticsPagesOut,
    AnalyticsProductCardsOut,
    AnalyticsQueryReviewSnapshotOut,
    AnalyticsSourcesOut,
    AnalyticsSummaryOut,
)
from app.services.analytics_query_review_service import get_latest_query_review, run_query_review
from app.services.site_analytics_service import (
    get_activity,
    get_conversion_trend,
    get_forms,
    get_funnel,
    get_landings,
    get_page_detail,
    get_pages,
    get_product_cards,
    get_sources,
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


@router.get("/funnel", response_model=AnalyticsFunnelOut)
def analytics_funnel(
    days: int = Query(7, ge=1, le=365),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    validate_days(days)
    return get_funnel(db, days)


@router.get("/sources", response_model=AnalyticsSourcesOut)
def analytics_sources(
    days: int = Query(7, ge=1, le=365),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    validate_days(days)
    return get_sources(db, days)


@router.get("/landings", response_model=AnalyticsLandingsOut)
def analytics_landings(
    days: int = Query(7, ge=1, le=365),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    validate_days(days)
    return get_landings(db, days)


@router.get("/conversions/trend", response_model=AnalyticsConversionTrendOut)
def analytics_conversion_trend(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    validate_days(days)
    return get_conversion_trend(db, days)


@router.get("/query-review/latest", response_model=AnalyticsQueryReviewSnapshotOut)
def analytics_query_review_latest(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    snapshot = get_latest_query_review(db)
    if snapshot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Снимок ещё не создан")
    return snapshot


@router.post("/query-review/run", response_model=AnalyticsQueryReviewSnapshotOut)
def analytics_query_review_run(
    days: int = Query(28, ge=7, le=90),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    return run_query_review(db, days=days, limit=limit)
