from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

SeoLandingKind = Literal["brand_new", "category_new", "brand_used", "category_used", "geo"]


class SeoLandingPageBase(BaseModel):
    kind: SeoLandingKind
    slug: Optional[str] = Field(None, max_length=120)
    title_ru: str = Field(..., min_length=1, max_length=255)
    search_query: Optional[str] = Field(None, max_length=255)
    brand_name: Optional[str] = Field(None, max_length=120)
    part_type_id: Optional[int] = None
    city: Optional[str] = Field(None, max_length=120)
    meta_title: Optional[str] = Field(None, max_length=255)
    meta_description: Optional[str] = Field(None, max_length=512)
    intro_html: Optional[str] = None
    is_active: bool = True
    priority: int = Field(default=0, ge=0)


class SeoLandingPageCreate(SeoLandingPageBase):
    pass


class SeoLandingPageUpdate(BaseModel):
    kind: Optional[SeoLandingKind] = None
    slug: Optional[str] = Field(None, max_length=120)
    title_ru: Optional[str] = Field(None, min_length=1, max_length=255)
    search_query: Optional[str] = Field(None, max_length=255)
    brand_name: Optional[str] = Field(None, max_length=120)
    part_type_id: Optional[int] = None
    city: Optional[str] = Field(None, max_length=120)
    meta_title: Optional[str] = Field(None, max_length=255)
    meta_description: Optional[str] = Field(None, max_length=512)
    intro_html: Optional[str] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = Field(None, ge=0)


class SeoLandingPageView(SeoLandingPageBase):
    id: int
    slug: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SeoLandingResolveOut(BaseModel):
    kind: SeoLandingKind
    slug: str
    title_ru: str
    search_query: Optional[str] = None
    brand_name: Optional[str] = None
    part_type_id: Optional[int] = None
    city: Optional[str] = None
    meta_title: str
    meta_description: str
    intro_html: Optional[str] = None
    filters: dict[str, Any]
    canonical_path: str


class SeoLandingSeedResult(BaseModel):
    created_brand_new: int = 0
    created_category_new: int = 0
    skipped: int = 0
    total_rows: int = 0
