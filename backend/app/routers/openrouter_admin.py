from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin_user
from app.db.database import get_db
from app.models.organization import Organization
from app.models.organization_ai_description_access import OrganizationAiDescriptionAccess
from app.models.user import User
from app.services.ai_description_service import (
    RECOMMENDED_FREE_MODELS,
    get_global_usage,
    get_plain_api_key,
    test_openrouter_connection,
)
from app.services.audit_service import log_audit
from app.utils.openrouter_crypto import encrypt_openrouter_secret
from app.utils.openrouter_integration_db import get_or_create_openrouter_integration

router = APIRouter(prefix="/admin/openrouter", tags=["Admin OpenRouter"])


class OpenRouterCredentialsPayload(BaseModel):
    api_key: str = Field(..., min_length=10, max_length=2048)


class OpenRouterSettingsPatch(BaseModel):
    model_id: Optional[str] = Field(None, min_length=3, max_length=128)
    is_enabled: Optional[bool] = None
    daily_limit: Optional[int] = Field(None, ge=1, le=10000)
    per_org_daily_limit: Optional[int] = Field(None, ge=1, le=1000)


class OpenRouterIntegrationView(BaseModel):
    is_enabled: bool
    api_key_configured: bool
    model_id: str
    daily_limit: int
    per_org_daily_limit: int
    requests_today: int
    recommended_models: list[str]


class OrganizationAiAccessView(BaseModel):
    id: str
    name: Optional[str] = None
    ai_description_enabled: bool
    enabled_at: Optional[datetime] = None
    notes: Optional[str] = None


class OrganizationAiAccessPatch(BaseModel):
    is_enabled: bool
    notes: Optional[str] = Field(None, max_length=255)


class OrganizationAiBulkPayload(BaseModel):
    organization_ids: list[str] = Field(..., min_length=1)
    is_enabled: bool


class OpenRouterTestResult(BaseModel):
    ok: bool
    model: str
    sample: str
    tokens_used: Optional[int] = None


def _integration_view(row) -> OpenRouterIntegrationView:
    used, _limit = get_global_usage(row)
    return OpenRouterIntegrationView(
        is_enabled=bool(row.is_enabled),
        api_key_configured=bool(row.api_key_encrypted),
        model_id=str(row.model_id or RECOMMENDED_FREE_MODELS[0]),
        daily_limit=int(row.daily_limit or 50),
        per_org_daily_limit=int(row.per_org_daily_limit or 10),
        requests_today=used,
        recommended_models=list(RECOMMENDED_FREE_MODELS),
    )


@router.get("/integration", response_model=OpenRouterIntegrationView)
def get_openrouter_integration(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    return _integration_view(get_or_create_openrouter_integration(db))


@router.post("/credentials", response_model=OpenRouterIntegrationView)
def save_openrouter_credentials(
    payload: OpenRouterCredentialsPayload,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_openrouter_integration(db)
    row.api_key_encrypted = encrypt_openrouter_secret(payload.api_key.strip())
    db.add(row)
    db.commit()
    db.refresh(row)
    log_audit(
        db,
        event_type="openrouter_credentials_updated",
        category="settings",
        summary="Обновлён API-ключ OpenRouter",
        user=current_user,
    )
    return _integration_view(row)


@router.patch("/settings", response_model=OpenRouterIntegrationView)
def patch_openrouter_settings(
    payload: OpenRouterSettingsPatch,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_openrouter_integration(db)
    data = payload.dict(exclude_unset=True)
    if "model_id" in data and data["model_id"]:
        row.model_id = data["model_id"].strip()
    if "is_enabled" in data:
        row.is_enabled = bool(data["is_enabled"])
    if "daily_limit" in data:
        row.daily_limit = int(data["daily_limit"])
    if "per_org_daily_limit" in data:
        row.per_org_daily_limit = int(data["per_org_daily_limit"])
    db.add(row)
    db.commit()
    db.refresh(row)
    log_audit(
        db,
        event_type="openrouter_settings_updated",
        category="settings",
        summary="Обновлены настройки OpenRouter",
        user=current_user,
    )
    return _integration_view(row)


@router.post("/test", response_model=OpenRouterTestResult)
def test_openrouter(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    if not get_plain_api_key(get_or_create_openrouter_integration(db)):
        raise HTTPException(status_code=400, detail="API-ключ не настроен")
    result = test_openrouter_connection(db)
    return OpenRouterTestResult(**result)


@router.get("/organizations", response_model=list[OrganizationAiAccessView])
def list_openrouter_organizations(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    orgs = db.query(Organization).order_by(Organization.name.asc()).all()
    access_rows = {
        row.organization_id: row
        for row in db.query(OrganizationAiDescriptionAccess).all()
    }
    items: list[OrganizationAiAccessView] = []
    for org in orgs:
        access = access_rows.get(org.id)
        items.append(
            OrganizationAiAccessView(
                id=org.id,
                name=org.name,
                ai_description_enabled=bool(access and access.is_enabled),
                enabled_at=access.enabled_at if access else None,
                notes=access.notes if access else None,
            )
        )
    return items


@router.put("/organizations/{org_id}", response_model=OrganizationAiAccessView)
def set_organization_ai_access(
    org_id: str,
    payload: OrganizationAiAccessPatch,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if org is None:
        raise HTTPException(status_code=404, detail="Организация не найдена")

    row = (
        db.query(OrganizationAiDescriptionAccess)
        .filter(OrganizationAiDescriptionAccess.organization_id == org_id)
        .first()
    )
    if row is None:
        row = OrganizationAiDescriptionAccess(organization_id=org_id)
        db.add(row)

    row.is_enabled = bool(payload.is_enabled)
    row.enabled_by_user_id = current_user.id
    row.notes = (payload.notes or "").strip() or None
    db.commit()
    db.refresh(row)

    log_audit(
        db,
        event_type="openrouter_org_access_updated",
        category="settings",
        summary=f"AI-описания для org {org_id}: {'вкл' if row.is_enabled else 'выкл'}",
        user=current_user,
        organization_id=org_id,
    )

    return OrganizationAiAccessView(
        id=org.id,
        name=org.name,
        ai_description_enabled=bool(row.is_enabled),
        enabled_at=row.enabled_at,
        notes=row.notes,
    )


@router.post("/organizations/bulk", response_model=list[OrganizationAiAccessView])
def bulk_set_organization_ai_access(
    payload: OrganizationAiBulkPayload,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    org_ids = [oid.strip() for oid in payload.organization_ids if oid and oid.strip()]
    if not org_ids:
        raise HTTPException(status_code=400, detail="Список организаций пуст")

    orgs = db.query(Organization).filter(Organization.id.in_(org_ids)).all()
    org_by_id = {org.id: org for org in orgs}
    results: list[OrganizationAiAccessView] = []

    for org_id in org_ids:
        org = org_by_id.get(org_id)
        if org is None:
            continue
        row = (
            db.query(OrganizationAiDescriptionAccess)
            .filter(OrganizationAiDescriptionAccess.organization_id == org_id)
            .first()
        )
        if row is None:
            row = OrganizationAiDescriptionAccess(organization_id=org_id)
            db.add(row)
        row.is_enabled = bool(payload.is_enabled)
        row.enabled_by_user_id = current_user.id
        results.append(
            OrganizationAiAccessView(
                id=org.id,
                name=org.name,
                ai_description_enabled=bool(row.is_enabled),
                enabled_at=row.enabled_at,
                notes=row.notes,
            )
        )

    db.commit()
    log_audit(
        db,
        event_type="openrouter_org_access_bulk",
        category="settings",
        summary=f"Массовое обновление AI-доступа: {len(results)} org",
        user=current_user,
    )
    return results
