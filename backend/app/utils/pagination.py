from __future__ import annotations

from datetime import datetime
from typing import Any, List

from fastapi import Query

DEFAULT_PAGE_LIMIT = 50
MAX_PAGE_LIMIT = 200
# Справочники, которые мобильный клиент читает целиком за один запрос (склад, работы).
CATALOG_MAX_PAGE_LIMIT = 500


class PageParams:
    def __init__(
        self,
        limit: int = Query(DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
        offset: int = Query(0, ge=0),
    ):
        self.limit = limit
        self.offset = offset


class CatalogPageParams(PageParams):
    def __init__(
        self,
        limit: int = Query(DEFAULT_PAGE_LIMIT, ge=1, le=CATALOG_MAX_PAGE_LIMIT),
        offset: int = Query(0, ge=0),
    ):
        self.limit = limit
        self.offset = offset


def build_page(items: List[Any], total: int, page: PageParams) -> dict:
    return {
        "items": items,
        "total": total,
        "has_more": page.offset + len(items) < total,
        "fetched_at": datetime.now().isoformat(timespec="seconds"),
    }
