from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ArticleMatchListItem(BaseModel):
    id: int
    source: Literal["product", "pending"]
    article: str = ""
    brand: str = ""
    name: str = ""
    quantity: int = 0
    price: Optional[float] = None
    photo_url: Optional[str] = None
    created_at: Optional[datetime] = None
    created_by: Optional[int] = None
    creator_full_name: Optional[str] = None
    is_exact: bool = False


class ArticleMatchesResponse(BaseModel):
    items: list[ArticleMatchListItem]
    total: int
    has_more: bool
    offset: int
    limit: int


class ArticleMatchStorageCellOut(BaseModel):
    id: int
    storage_cell_id: int
    value: Optional[str] = None
    cell_name: Optional[str] = None


class ArticleMatchMediaOut(BaseModel):
    url: str
    kind: Literal["photo", "video"] = "photo"


class ArticleMatchDetailResponse(BaseModel):
    id: int
    source: Literal["product", "pending"]
    article: str = ""
    brand: str = ""
    name: str = ""
    description: Optional[str] = None
    quantity: int = 0
    price: Optional[float] = None
    is_new: bool = True
    storage_location_id: Optional[int] = None
    storage_location_address: Optional[str] = None
    part_type_id: Optional[int] = None
    created_by: Optional[int] = None
    creator_full_name: Optional[str] = None
    created_at: Optional[datetime] = None
    media: list[ArticleMatchMediaOut] = Field(default_factory=list)
    storage_cells: list[ArticleMatchStorageCellOut] = Field(default_factory=list)
    photos: list[str] = Field(default_factory=list)
    videos: list[str] = Field(default_factory=list)
