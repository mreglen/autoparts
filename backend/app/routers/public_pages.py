from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.spa_page_check_service import is_spa_page_available

router = APIRouter(tags=["Public pages"])


@router.get("/public/page-check")
def public_page_check(
    path: str = Query(..., min_length=1, max_length=2048),
    db: Session = Depends(get_db),
):
    """
    Проверка существования SPA-страницы для nginx auth_request.
    204 — страница существует, 404 — нет.
    """
    if is_spa_page_available(db, path):
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
