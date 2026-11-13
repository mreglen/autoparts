from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_expense import AutoserviceExpense, AutoserviceExpenseArticle
from app.models.user import User
from app.schemas.autoservice_finance import (
    AutoserviceExpenseArticleCreate,
    AutoserviceExpenseArticleUpdate,
    AutoserviceExpenseArticleView,
)
from app.services.autoservice_audit import log_autoservice
from app.utils.autoservice_access import (
    AUTOSERVICE_PERMISSION_FINANCE,
    AUTOSERVICE_PERMISSION_REPORTS,
    AUTOSERVICE_PERMISSION_SETTINGS,
    require_any_autoservice_permission,
    require_autoservice_settings,
)

router = APIRouter(tags=["Autoservice expense articles"])


def _get_org_article_or_404(db: Session, org_id: str, article_id: int) -> AutoserviceExpenseArticle:
    row = (
        db.query(AutoserviceExpenseArticle)
        .filter(
            AutoserviceExpenseArticle.id == article_id,
            AutoserviceExpenseArticle.organization_id == org_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Статья расхода не найдена")
    return row


def _name_taken(db: Session, org_id: str, name: str, exclude_id: int | None = None) -> bool:
    query = db.query(AutoserviceExpenseArticle.id).filter(
        AutoserviceExpenseArticle.organization_id == org_id,
        func.lower(AutoserviceExpenseArticle.name) == name.lower(),
    )
    if exclude_id is not None:
        query = query.filter(AutoserviceExpenseArticle.id != exclude_id)
    return query.first() is not None


def _clean_name(name: str | None) -> str:
    return (name or "").strip()


def find_or_create_expense_article(db: Session, org_id: str, name: str) -> AutoserviceExpenseArticle | None:
    cleaned = _clean_name(name)
    if not cleaned:
        return None
    row = (
        db.query(AutoserviceExpenseArticle)
        .filter(
            AutoserviceExpenseArticle.organization_id == org_id,
            func.lower(AutoserviceExpenseArticle.name) == cleaned.lower(),
        )
        .first()
    )
    if row:
        return row
    row = AutoserviceExpenseArticle(organization_id=org_id, name=cleaned[:120])
    db.add(row)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        row = (
            db.query(AutoserviceExpenseArticle)
            .filter(
                AutoserviceExpenseArticle.organization_id == org_id,
                func.lower(AutoserviceExpenseArticle.name) == cleaned.lower(),
            )
            .first()
        )
        if not row:
            raise
    return row


@router.get("/autoservice/expense-articles", response_model=list[AutoserviceExpenseArticleView])
def list_expense_articles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_any_autoservice_permission(
        db,
        current_user,
        AUTOSERVICE_PERMISSION_FINANCE,
        AUTOSERVICE_PERMISSION_REPORTS,
        AUTOSERVICE_PERMISSION_SETTINGS,
    )
    rows = (
        db.query(AutoserviceExpenseArticle)
        .filter(AutoserviceExpenseArticle.organization_id == org_id)
        .order_by(AutoserviceExpenseArticle.name.asc(), AutoserviceExpenseArticle.id.asc())
        .all()
    )
    return rows


@router.post(
    "/autoservice/expense-articles",
    response_model=AutoserviceExpenseArticleView,
    status_code=status.HTTP_201_CREATED,
)
def create_expense_article(
    payload: AutoserviceExpenseArticleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_settings(db, current_user)
    name = _clean_name(payload.name)
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Укажите название статьи")
    if _name_taken(db, org_id, name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Статья с таким названием уже есть",
        )
    row = AutoserviceExpenseArticle(organization_id=org_id, name=name[:120])
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Статья с таким названием уже есть",
        )
    db.refresh(row)
    log_autoservice(
        db,
        event_type="expense_article_created",
        summary=f"Создана статья расхода «{row.name}»",
        user=current_user,
        organization_id=org_id,
        entity_type="expense_article",
        entity_id=row.id,
    )
    return row


@router.patch(
    "/autoservice/expense-articles/{article_id}",
    response_model=AutoserviceExpenseArticleView,
)
def update_expense_article(
    article_id: int,
    payload: AutoserviceExpenseArticleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_settings(db, current_user)
    row = _get_org_article_or_404(db, org_id, article_id)
    name = _clean_name(payload.name)
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Укажите название статьи")
    if _name_taken(db, org_id, name, exclude_id=row.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Статья с таким названием уже есть",
        )
    row.name = name[:120]
    db.commit()
    db.refresh(row)
    log_autoservice(
        db,
        event_type="expense_article_updated",
        summary=f"Статья расхода переименована в «{row.name}»",
        user=current_user,
        organization_id=org_id,
        entity_type="expense_article",
        entity_id=row.id,
    )
    return row


@router.delete("/autoservice/expense-articles/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense_article(
    article_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_settings(db, current_user)
    row = _get_org_article_or_404(db, org_id, article_id)
    db.query(AutoserviceExpense).filter(
        AutoserviceExpense.article_id == row.id,
        AutoserviceExpense.organization_id == org_id,
    ).update({"article_id": None}, synchronize_session=False)
    db.delete(row)
    db.commit()
    log_autoservice(
        db,
        event_type="expense_article_deleted",
        summary=f"Удалена статья расхода «{row.name}»",
        user=current_user,
        organization_id=org_id,
        entity_type="expense_article",
        entity_id=row.id,
    )
