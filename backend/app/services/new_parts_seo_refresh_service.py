from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.new_parts_seo_card import NewPartsSeoCard
from app.services.new_parts_seo_card_service import (
    ROSSKO_NEW_PART_SOURCE,
    create_or_get_new_part_card,
)
from app.services.new_parts_seo_sync_service import _fetch_rossko_search
from app.services.rossko_part_selection import pick_best_rossko_part, rossko_part_to_card_payload

logger = logging.getLogger(__name__)


@dataclass
class RefreshResult:
    candidates: int = 0
    processed: int = 0
    updated: int = 0
    not_found: int = 0
    errors: int = 0
    details: list[str] = field(default_factory=list)


def iter_cards_for_refresh(db: Session, *, limit: int) -> list[NewPartsSeoCard]:
    safe_limit = max(1, min(int(limit or 1), 500))
    return (
        db.query(NewPartsSeoCard)
        .filter(
            NewPartsSeoCard.is_active.is_(True),
            func.lower(NewPartsSeoCard.source) == ROSSKO_NEW_PART_SOURCE,
        )
        .order_by(NewPartsSeoCard.updated_at.asc().nullsfirst(), NewPartsSeoCard.id.asc())
        .limit(safe_limit)
        .all()
    )


async def refresh_new_parts_seo_cards(
    db: Session,
    *,
    batch_size: int | None = None,
    rossko_delay_sec: float | None = None,
) -> RefreshResult:
    limit = batch_size if batch_size is not None else settings.NEW_PARTS_SEO_REFRESH_BATCH_SIZE
    delay = rossko_delay_sec if rossko_delay_sec is not None else settings.NEW_PARTS_SEO_SYNC_ROSSKO_DELAY_SEC
    result = RefreshResult()
    cards = iter_cards_for_refresh(db, limit=limit)
    result.candidates = len(cards)

    for card in cards:
        result.processed += 1
        try:
            search_text = f"{card.brand} {card.article}".strip()
            rossko_data = await _fetch_rossko_search(db, search_text)
            best_part = pick_best_rossko_part(
                rossko_data,
                brand=card.brand,
                article=card.article,
            )
            if best_part is None:
                result.not_found += 1
                if delay > 0:
                    await asyncio.sleep(delay)
                continue

            payload = rossko_part_to_card_payload(best_part)
            create_or_get_new_part_card(db, payload)
            result.updated += 1
        except Exception:
            logger.exception(
                "SEO refresh failed for card_id=%s brand=%s article=%s",
                card.id,
                card.brand,
                card.article,
            )
            result.errors += 1

        if delay > 0:
            await asyncio.sleep(delay)

    return result
