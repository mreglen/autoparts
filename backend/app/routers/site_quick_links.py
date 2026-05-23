from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin_user
from app.db.database import get_db
from app.models.site_quick_link import SiteQuickLink
from app.models.user import User
from app.schemas.site_quick_link import (
    SiteQuickLinkCreate,
    SiteQuickLinkUpdate,
    SiteQuickLinkView,
)
from app.services.audit_service import log_audit
from app.services.site_quick_links_service import list_quick_links, normalize_quick_link_url

router = APIRouter(tags=["Site quick links"])


@router.get("/public/site-quick-links", response_model=list[SiteQuickLinkView])
def get_public_site_quick_links(db: Session = Depends(get_db)):
    return list_quick_links(db, enabled_only=True)


@router.get("/admin/site-quick-links", response_model=list[SiteQuickLinkView])
def get_admin_site_quick_links(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    return list_quick_links(db, enabled_only=False)


@router.post("/admin/site-quick-links", response_model=SiteQuickLinkView)
def create_site_quick_link(
    payload: SiteQuickLinkCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    try:
        url = normalize_quick_link_url(payload.url)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    row = SiteQuickLink(
        title=payload.title.strip(),
        url=url,
        enabled=bool(payload.enabled),
        sort_order=int(payload.sort_order),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    log_audit(
        db,
        event_type="site_quick_link_created",
        category="settings",
        summary=f"Добавлена быстрая ссылка: {row.title} → {row.url}",
        user=current_user,
    )
    return row


@router.patch("/admin/site-quick-links/{link_id}", response_model=SiteQuickLinkView)
def update_site_quick_link(
    link_id: int,
    payload: SiteQuickLinkUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = db.query(SiteQuickLink).filter(SiteQuickLink.id == link_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Быстрая ссылка не найдена")

    data = payload.model_dump(exclude_unset=True)
    if "url" in data:
        try:
            data["url"] = normalize_quick_link_url(data["url"])
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if "title" in data:
        data["title"] = data["title"].strip()

    for key, value in data.items():
        setattr(row, key, value)

    db.commit()
    db.refresh(row)
    log_audit(
        db,
        event_type="site_quick_link_updated",
        category="settings",
        summary=f"Обновлена быстрая ссылка: {row.title} → {row.url}",
        user=current_user,
    )
    return row


@router.delete("/admin/site-quick-links/{link_id}")
def delete_site_quick_link(
    link_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = db.query(SiteQuickLink).filter(SiteQuickLink.id == link_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Быстрая ссылка не найдена")

    title = row.title
    url = row.url
    db.delete(row)
    db.commit()
    log_audit(
        db,
        event_type="site_quick_link_deleted",
        category="settings",
        summary=f"Удалена быстрая ссылка: {title} → {url}",
        user=current_user,
    )
    return {"ok": True}
