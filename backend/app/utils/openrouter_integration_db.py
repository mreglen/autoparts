from sqlalchemy.orm import Session

from app.models.site_openrouter_integration import SiteOpenRouterIntegration

_OPENROUTER_INTEGRATION_ID = 1
DEFAULT_MODEL_ID = "meta-llama/llama-3.3-70b-instruct:free"


def get_or_create_openrouter_integration(db: Session) -> SiteOpenRouterIntegration:
    row = (
        db.query(SiteOpenRouterIntegration)
        .filter(SiteOpenRouterIntegration.id == _OPENROUTER_INTEGRATION_ID)
        .first()
    )
    if row is None:
        row = SiteOpenRouterIntegration(
            id=_OPENROUTER_INTEGRATION_ID,
            model_id=DEFAULT_MODEL_ID,
            is_enabled=False,
            daily_limit=50,
            per_org_daily_limit=10,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row
