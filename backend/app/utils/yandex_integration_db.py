from sqlalchemy.orm import Session

from app.models.site_yandex_integration import SiteYandexIntegration
from app.models.yandex_feed_sync_state import YandexFeedSyncState

_YANDEX_INTEGRATION_ID = 1
_YANDEX_FEED_SYNC_STATE_ID = 1


def get_or_create_yandex_integration(db: Session) -> SiteYandexIntegration:
    row = (
        db.query(SiteYandexIntegration)
        .filter(SiteYandexIntegration.id == _YANDEX_INTEGRATION_ID)
        .first()
    )
    if row is None:
        row = SiteYandexIntegration(id=_YANDEX_INTEGRATION_ID)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def get_or_create_yandex_feed_sync_state(db: Session) -> YandexFeedSyncState:
    row = (
        db.query(YandexFeedSyncState)
        .filter(YandexFeedSyncState.id == _YANDEX_FEED_SYNC_STATE_ID)
        .first()
    )
    if row is None:
        row = YandexFeedSyncState(id=_YANDEX_FEED_SYNC_STATE_ID)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row
