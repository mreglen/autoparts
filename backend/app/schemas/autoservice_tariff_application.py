from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AutoserviceTariffApplicationCreate(BaseModel):
    contact_name: str = Field(..., min_length=1, max_length=160)
    contact_phone: str = Field(..., min_length=5, max_length=32)
    message: Optional[str] = Field(None, max_length=2000)


class AutoserviceTariffApplicationOut(BaseModel):
    id: int
    organization_id: str
    organization_name: Optional[str] = None
    applicant_user_id: int
    applicant_name: Optional[str] = None
    contact_name: str
    contact_phone: str
    message: Optional[str] = None
    status: str
    rejection_reason: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    organization_is_autoservice: bool = False

    class Config:
        from_attributes = True


class AutoserviceTariffApplicationReject(BaseModel):
    reason: Optional[str] = Field(None, max_length=2000)


class AutoserviceConnectedOrganizationOut(BaseModel):
    organization_id: str
    organization_name: str
    organization_phone: Optional[str] = None
    application_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    is_active: bool = True
