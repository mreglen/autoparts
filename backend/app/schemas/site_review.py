from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SiteReviewView(BaseModel):
    id: int
    author_name: str
    author_role: Optional[str] = None
    text: str
    rating: int = Field(ge=1, le=5)
    source: str
    review_date: Optional[datetime] = None
    featured: bool = False

    model_config = {"from_attributes": True}


class SiteReviewsSummary(BaseModel):
    average_rating: float
    total_count: int
    reviews: list[SiteReviewView]


class SiteReviewCreateIn(BaseModel):
    text: str = Field(min_length=10, max_length=2000)
    rating: int = Field(ge=1, le=5)
    author_name: Optional[str] = Field(None, min_length=2, max_length=120)
