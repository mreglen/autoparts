from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from app.core.config import settings
from app.utils.yandex_integration_db import get_or_create_yandex_feed_sync_state


ALLOWED_FEED_TYPES = {
    "REALTY",
    "VACANCY",
    "GOODS",
    "DOCTORS",
    "CARS",
    "SERVICES",
    "EDUCATION",
    "ACTIVITY",
}


def normalize_feed_type(value: str | None) -> str:
    feed_type = (value or "GOODS").strip().upper()
    if feed_type not in ALLOWED_FEED_TYPES:
        return "GOODS"
    return feed_type


def parse_region_ids_csv(csv_value: str | None) -> list[int]:
    if not csv_value:
        return [225]
    out: list[int] = []
    for part in str(csv_value).split(","):
        p = part.strip()
        if not p:
            continue
        try:
            num = int(p)
        except ValueError:
            continue
        if num > 0:
            out.append(num)
    return out or [225]


def normalize_region_ids_csv(csv_value: str | None) -> str:
    ids = parse_region_ids_csv(csv_value)
    return ",".join(str(i) for i in ids)


def resolve_site_origin(host_url: str | None = None) -> str:
    if host_url:
        trimmed = host_url.strip().rstrip("/")
        if trimmed:
            parsed = urlparse(trimmed)
            if parsed.scheme and parsed.netloc:
                return f"{parsed.scheme}://{parsed.netloc}"
    base = (settings.PUBLIC_BASE_URL or "").strip().rstrip("/")
    parsed = urlparse(base)
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}"
    return "https://svoygarage.ru"


def build_public_feed_url(host_url: str | None) -> str:
    return f"{resolve_site_origin(host_url)}/api/feeds/yandex/used.yml"


def mark_yandex_feed_dirty(db: Session, reason: str) -> None:
    """Помечает фид б/у товаров для Яндекса как устаревший (синхронизация по расписанию)."""
    state = get_or_create_yandex_feed_sync_state(db)
    state.pending_sync = True
    state.last_change_reason = (reason or "").strip()[:128] or "unknown"
    state.last_event_at = datetime.now(timezone.utc)
    db.add(state)
    db.commit()
    db.refresh(state)


def mark_yandex_feed_dirty_for_used_product(db: Session, product, reason: str) -> None:
    """Помечает фид только для б/у товаров (is_new=False), попадающих в YML."""
    if product is not None and getattr(product, "is_new", True) is False:
        mark_yandex_feed_dirty(db, reason)
