from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.seo_landing_page import (
    SeoLandingPageCreate,
    SeoLandingPageUpdate,
    SeoLandingPageView,
    SeoLandingResolveOut,
    SeoLandingSeedResult,
)
from app.services.audit_service import log_audit
from app.services.seo_landing_page_service import (
    SeoLandingPageValidationError,
    create_landing_page,
    delete_landing_page,
    get_landing_page_by_id,
    list_landing_pages,
    resolve_landing_page,
    seed_landing_pages_from_catalog,
    update_landing_page,
)

router = APIRouter(tags=["SEO landing pages"])


@router.get("/public/seo/landings/{kind}/{slug}", response_model=SeoLandingResolveOut)
def get_public_landing_resolve(kind: str, slug: str, db: Session = Depends(get_db)):
    result = resolve_landing_page(db, kind, slug)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Посадочная не найдена")
    return result


@router.get("/admin/seo/landing-pages", response_model=list[SeoLandingPageView])
def get_admin_landing_pages(
    kind: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    q: Optional[str] = Query(None),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    return list_landing_pages(db, kind=kind, is_active=is_active, q=q)


@router.post("/admin/seo/landing-pages/seed-from-catalog", response_model=SeoLandingSeedResult)
def seed_admin_landing_pages_from_catalog(
    force: bool = Query(False),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    result = seed_landing_pages_from_catalog(db, force=force)
    log_audit(
        db,
        event_type="seo_landing_pages_seeded",
        category="seo",
        summary=(
            f"Seed посадочных: brand_new={result.created_brand_new}, "
            f"category_new={result.created_category_new}, skipped={result.skipped}"
        ),
        user=current_user,
    )
    return result


@router.get("/admin/seo/landing-pages/{landing_id}", response_model=SeoLandingPageView)
def get_admin_landing_page(
    landing_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    row = get_landing_page_by_id(db, landing_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Посадочная не найдена")
    return row


@router.post("/admin/seo/landing-pages", response_model=SeoLandingPageView)
def create_admin_landing_page(
    payload: SeoLandingPageCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    try:
        row = create_landing_page(db, payload)
    except SeoLandingPageValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    log_audit(
        db,
        event_type="seo_landing_page_created",
        category="seo",
        summary=f"Создана посадочная {row.kind}/{row.slug}: {row.title_ru}",
        user=current_user,
    )
    return row


@router.patch("/admin/seo/landing-pages/{landing_id}", response_model=SeoLandingPageView)
def update_admin_landing_page(
    landing_id: int,
    payload: SeoLandingPageUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_landing_page_by_id(db, landing_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Посадочная не найдена")
    try:
        row = update_landing_page(db, row, payload)
    except SeoLandingPageValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    log_audit(
        db,
        event_type="seo_landing_page_updated",
        category="seo",
        summary=f"Обновлена посадочная {row.kind}/{row.slug}: {row.title_ru}",
        user=current_user,
    )
    return row


@router.delete("/admin/seo/landing-pages/{landing_id}")
def delete_admin_landing_page(
    landing_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_landing_page_by_id(db, landing_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Посадочная не найдена")
    kind_slug = f"{row.kind}/{row.slug}"
    title = row.title_ru
    delete_landing_page(db, row)
    log_audit(
        db,
        event_type="seo_landing_page_deleted",
        category="seo",
        summary=f"Удалена посадочная {kind_slug}: {title}",
        user=current_user,
    )
    return {"ok": True}
