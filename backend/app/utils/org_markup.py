"""Helpers for per-organization new-parts markup."""
from typing import Optional

from sqlalchemy.orm import Session

from app.models.organization import Organization
from app.models.site_settings import SiteSettings
from app.utils.site_settings_db import get_or_create_site_settings


def global_markup_percent(settings_row: Optional[SiteSettings]) -> float:
    if settings_row is None:
        return 15.0
    value = getattr(settings_row, "new_parts_markup_percent", None)
    return float(value) if value is not None else 15.0


def effective_markup_percent(org: Optional[Organization], settings_row: Optional[SiteSettings] = None) -> float:
    """Manual org override wins; otherwise use global site markup."""
    if org is not None and getattr(org, "new_parts_markup_manual", False):
        org_value = getattr(org, "new_parts_markup_percent", None)
        if org_value is not None:
            return float(org_value)
    if settings_row is None:
        return 15.0
    return global_markup_percent(settings_row)


def sync_org_markup_from_global(db: Session, org: Organization, global_percent: float, *, force: bool) -> None:
    """Update org stored markup when not manual (or when force=True)."""
    if not force and getattr(org, "new_parts_markup_manual", False):
        return
    org.new_parts_markup_percent = float(global_percent)
    if force:
        org.new_parts_markup_manual = False


def apply_global_markup_to_organizations(
    db: Session,
    global_percent: float,
    *,
    skip_manual: bool,
) -> int:
    """Returns count of organizations updated."""
    query = db.query(Organization)
    if skip_manual:
        query = query.filter(Organization.new_parts_markup_manual.is_(False))
    orgs = query.all()
    for org in orgs:
        org.new_parts_markup_percent = float(global_percent)
        if not skip_manual:
            org.new_parts_markup_manual = False
    return len(orgs)
