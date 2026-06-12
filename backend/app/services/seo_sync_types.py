from __future__ import annotations

from dataclasses import dataclass

SOURCE_ORDER = "order"
SOURCE_PRODUCT = "product"
SOURCE_SIBLING = "sibling"
SOURCE_CROSS = "cross"
SOURCE_SEED_READY = "seed_ready"

SOURCE_PRIORITY = {
    SOURCE_SEED_READY: -1,
    SOURCE_ORDER: 0,
    SOURCE_PRODUCT: 1,
    SOURCE_SIBLING: 2,
    SOURCE_CROSS: 3,
}


@dataclass
class SyncCandidate:
    lookup_key: str
    brand: str
    article: str
    source: str = SOURCE_PRODUCT
    origin_source: str | None = None

    def get_origin_source(self) -> str:
        if self.origin_source:
            return self.origin_source
        if self.source == SOURCE_SEED_READY:
            return "unknown"
        return self.source
