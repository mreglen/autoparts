from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class DadataSuggestAddressIn(BaseModel):
    query: str = Field(..., min_length=1, max_length=300)
    count: int = Field(default=7, ge=1, le=20)
    locations: Optional[list[dict[str, str]]] = None


class DadataSuggestAddressOut(BaseModel):
    suggestions: list[dict[str, Any]]
