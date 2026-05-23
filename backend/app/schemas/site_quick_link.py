from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class SiteQuickLinkBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    url: str = Field(..., min_length=1, max_length=512)
    enabled: bool = True
    sort_order: int = Field(default=0, ge=0)


class SiteQuickLinkCreate(SiteQuickLinkBase):
    pass


class SiteQuickLinkUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    url: Optional[str] = Field(None, min_length=1, max_length=512)
    enabled: Optional[bool] = None
    sort_order: Optional[int] = Field(None, ge=0)


class SiteQuickLinkView(SiteQuickLinkBase):
    id: int

    class Config:
        from_attributes = True
