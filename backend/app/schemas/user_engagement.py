from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.product import ProductListItem


class FavoriteStatusOut(BaseModel):
    is_favorite: bool


class FavoritesListOut(BaseModel):
    items: List[ProductListItem]


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
