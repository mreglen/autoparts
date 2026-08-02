from sqlalchemy.orm import Session

from app.models.site_laximo_cat_integration import (
    DEFAULT_DAILY_REQUEST_LIMIT,
    DEFAULT_LAXIMO_CAT_BASE_URL,
    SiteLaximoCatIntegration,
)

_LAXIMO_CAT_INTEGRATION_ID = 1


def get_or_create_laximo_cat_integration(db: Session) -> SiteLaximoCatIntegration:
    row = (
        db.query(SiteLaximoCatIntegration)
        .filter(SiteLaximoCatIntegration.id == _LAXIMO_CAT_INTEGRATION_ID)
        .first()
    )
    if row is None:
        row = SiteLaximoCatIntegration(
            id=_LAXIMO_CAT_INTEGRATION_ID,
            base_url=DEFAULT_LAXIMO_CAT_BASE_URL,
            is_enabled=False,
            last_test_ok=False,
            daily_request_limit=DEFAULT_DAILY_REQUEST_LIMIT,
            requests_today=0,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row
