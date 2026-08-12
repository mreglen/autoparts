"""Helpers for per-organization new-parts markup."""
from typing import Optional

from sqlalchemy.orm import Session

from app.models.organization import Organization
from app.models.site_settings import SiteSettings
from app.utils.site_settings_db import get_or_create_site_settings

DEFAULT_BUYER_MARKUP_PERCENT = 30.0
DEFAULT_SELLER_MARKUP_PERCENT = 15.0
DEFAULT_AUTOSERVICE_MARKUP_PERCENT = 7.0


def global_markup_percent(settings_row: Optional[SiteSettings]) -> float:
    """Seller markup from site settings."""
    if settings_row is None:
        return DEFAULT_SELLER_MARKUP_PERCENT
    value = getattr(settings_row, "new_parts_markup_percent", None)
    return float(value) if value is not None else DEFAULT_SELLER_MARKUP_PERCENT


def buyer_markup_percent(settings_row: Optional[SiteSettings]) -> float:
    if settings_row is None:
        return DEFAULT_BUYER_MARKUP_PERCENT
    value = getattr(settings_row, "buyer_new_parts_markup_percent", None)
    return float(value) if value is not None else DEFAULT_BUYER_MARKUP_PERCENT


def autoservice_markup_percent(settings_row: Optional[SiteSettings]) -> float:
    if settings_row is None:
        return DEFAULT_AUTOSERVICE_MARKUP_PERCENT
    value = getattr(settings_row, "autoservice_new_parts_markup_percent", None)
    return float(value) if value is not None else DEFAULT_AUTOSERVICE_MARKUP_PERCENT


def effective_markup_percent(
    org: Optional[Organization],
    settings_row: Optional[SiteSettings] = None,
) -> float:
    """
    Choose markup percent for "seller context" pricing (used when we show markup inside seller workspace).

    Priority:
    1) If organization is autoservice => use autoservice markup (connected tariff rules),
       unless autoservice is paused (then fallback to seller markup).
    2) Fallback => use global seller markup from site_settings.new_parts_markup_percent.

    Note: manual per-organization markup is intentionally ignored, so that changing
    Rossko markup updates prices everywhere consistently.
    """
    if org is not None and getattr(org, "is_autoservice", False):
        # Если автосервис поставлен на паузу — считаем как для обычного продавца.
        if not getattr(org, "autoservice_paused", False):
            return autoservice_markup_percent(settings_row)
    if settings_row is None:
        return DEFAULT_SELLER_MARKUP_PERCENT
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
