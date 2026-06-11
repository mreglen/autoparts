from sqlalchemy.orm import Session

from app.models.site_google_integration import SiteGoogleIntegration

_GOOGLE_INTEGRATION_ID = 1


def get_or_create_google_integration(db: Session) -> SiteGoogleIntegration:
    row = (
        db.query(SiteGoogleIntegration)
        .filter(SiteGoogleIntegration.id == _GOOGLE_INTEGRATION_ID)
        .first()
    )
    if row is None:
        row = SiteGoogleIntegration(id=_GOOGLE_INTEGRATION_ID)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row
