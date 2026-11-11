from typing import Generic, List, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """Ответ постраничного списка: items + возраст данных для офлайн-метки."""

    items: List[T]
    total: int
    has_more: bool
    fetched_at: str
