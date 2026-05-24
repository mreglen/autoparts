from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user_optional
from app.db.database import get_db
from app.models.user import User
from app.schemas.site_review import SiteReviewCreateIn, SiteReviewView, SiteReviewsSummary
from app.services.site_reviews_service import (
    create_site_review,
    list_site_reviews,
    reviews_summary,
)
from app.utils.site_settings_db import site_reviews_enabled

router = APIRouter(tags=["Site reviews"])


def _empty_reviews_summary() -> SiteReviewsSummary:
    return SiteReviewsSummary(average_rating=0.0, total_count=0, reviews=[])


@router.get("/public/site-reviews", response_model=SiteReviewsSummary)
def get_public_site_reviews(
    featured: bool = Query(False),
    limit: int | None = Query(None, ge=1, le=50),
    db: Session = Depends(get_db),
):
    if not site_reviews_enabled(db):
        return _empty_reviews_summary()

    if featured:
        rows = list_site_reviews(db, featured_only=True, limit=limit or 6)
    else:
        rows = list_site_reviews(db, limit=limit)
    avg, count = reviews_summary(db, list_site_reviews(db))
    return SiteReviewsSummary(
        average_rating=avg,
        total_count=count,
        reviews=[SiteReviewView.model_validate(row) for row in rows],
    )


@router.post("/public/site-reviews", response_model=SiteReviewView, status_code=201)
def post_public_site_review(
    payload: SiteReviewCreateIn,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    if not site_reviews_enabled(db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Отзывы на сайте временно отключены",
        )
    row = create_site_review(db, payload, user=current_user)
    return SiteReviewView.model_validate(row)
