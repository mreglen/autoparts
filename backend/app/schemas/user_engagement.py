from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.product import (
    ProductListItem,
    ProductListOrganizationSummary,
    ProductListPhotoSummary,
    ProductListStorageSummary,
)


class FavoriteStatusOut(BaseModel):
    is_favorite: bool


class FavoriteListItem(BaseModel):
    kind: Literal["product", "rossko"] = "product"
    id: int
    brand: str
    article: str
    name: str
    price: float
    quantity: int = 0
    is_new: bool = False
    is_rossko: bool = False
    rossko_guid: Optional[str] = None
    organization_id: str = ""
    storage_location_id: int = 0
    created_at: Optional[datetime] = None
    list_photo_url: Optional[str] = None
    photos: List[ProductListPhotoSummary] = []
    organization: Optional[ProductListOrganizationSummary] = None
    storage_location: Optional[ProductListStorageSummary] = None
    favorite_created_at: Optional[datetime] = None


class FavoritesListOut(BaseModel):
    items: List[FavoriteListItem]


class RosskoFavoriteCreateIn(BaseModel):
    brand: str = Field(..., min_length=1, max_length=100)
    partnumber: str = Field(..., min_length=1, max_length=64)
    guid: Optional[str] = Field(None, max_length=64)
    title: Optional[str] = Field(None, max_length=512)
    min_price: Optional[float] = Field(None, ge=0)


class ProductViewsListOut(BaseModel):
    items: List[ProductListItem]


class SearchSubscriptionCreateIn(BaseModel):
    query: str = Field(..., min_length=2, max_length=512)


class SearchSubscriptionOut(BaseModel):
    id: int
    query_text: str
    is_active: bool
    created_at: datetime
    last_notified_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SearchSubscriptionsListOut(BaseModel):
    items: List[SearchSubscriptionOut]
