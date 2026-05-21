from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class AuditEventRow(BaseModel):
    id: int
    event_type: str
    event_type_label: str = ""
    category: Optional[str] = None
    category_label: Optional[str] = None
    summary: Optional[str] = None
    user_id: Optional[int] = None
    user_public_code: Optional[str] = None
    email: Optional[str] = None
    actor_name: Optional[str] = None
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    ip_address: Optional[str] = None
    details: Optional[str] = None
    details_parsed: Optional[Any] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditEventsResponse(BaseModel):
    rows: list[AuditEventRow] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    limit: int = 50
    pages: int = 0


class AuditFilterOption(BaseModel):
    code: str
    label: str


class AuditFiltersMetaResponse(BaseModel):
    categories: list[AuditFilterOption] = Field(default_factory=list)
    event_types: list[AuditFilterOption] = Field(default_factory=list)
    category_labels: dict[str, str] = Field(default_factory=dict)
    event_type_labels: dict[str, str] = Field(default_factory=dict)


class PermissionsContextResponse(BaseModel):
    org_has_admin_director: bool = False


class AuditOrgOption(BaseModel):
    id: str
    name: Optional[str] = None


class AuditUserOption(BaseModel):
    id: int
    public_code: str
    display_name: str
    email: Optional[str] = None


class AuditSearchHint(BaseModel):
    value: str
    hint_type: str
    label: Optional[str] = None


class AuditOrgOptionsResponse(BaseModel):
    items: list[AuditOrgOption] = Field(default_factory=list)


class AuditUserOptionsResponse(BaseModel):
    items: list[AuditUserOption] = Field(default_factory=list)


class AuditSearchHintsResponse(BaseModel):
    items: list[AuditSearchHint] = Field(default_factory=list)
