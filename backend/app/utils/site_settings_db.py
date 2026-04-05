"""Единственная строка site_settings (id = 1)."""
from sqlalchemy.orm import Session

from app.models.site_settings import SiteSettings

_SITE_SETTINGS_ID = 1


def get_or_create_site_settings(db: Session) -> SiteSettings:
    row = db.query(SiteSettings).filter(SiteSettings.id == _SITE_SETTINGS_ID).first()
    if row is None:
        row = SiteSettings(id=_SITE_SETTINGS_ID, show_new_autoparts=True)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row
