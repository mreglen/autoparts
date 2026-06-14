from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.internal_access import require_internal_prerender
from app.services.spa_page_check_service import is_spa_page_available
from app.services.site_analytics_service import get_popular_new_part_queries

router = APIRouter(tags=["Public pages"])


class PopularNewPartQueriesResponse(BaseModel):
    items: list[str]
    generated_at: datetime


@router.get("/public/page-check")
def public_page_check(
    path: str = Query(..., min_length=1, max_length=2048),
    db: Session = Depends(get_db),
    _: None = Depends(require_internal_prerender),
):
    """
    Проверка существования SPA-страницы для nginx auth_request.
    204 — страница существует, 404 — нет.
    """
    if is_spa_page_available(db, path):
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")


@router.get("/public/autoparts/new/popular-queries", response_model=PopularNewPartQueriesResponse)
def public_popular_new_part_queries(
    limit: int = Query(8, ge=1, le=20),
    db: Session = Depends(get_db),
):
    items, generated_at = get_popular_new_part_queries(db, limit=limit)
    return PopularNewPartQueriesResponse(items=items, generated_at=generated_at)
