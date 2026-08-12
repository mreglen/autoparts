"""Helpers for per-organization new-parts markup."""
from typing import Literal, Optional

from sqlalchemy.orm import Session

from app.models.organization import Organization
from app.models.site_settings import SiteSettings
from app.utils.site_settings_db import get_or_create_site_settings

DEFAULT_BUYER_MARKUP_PERCENT = 30.0
DEFAULT_SELLER_MARKUP_PERCENT = 15.0
DEFAULT_AUTOSERVICE_MARKUP_PERCENT = 7.0

MarkupTier = Literal["buyer", "seller", "autoservice"]
VALID_MARKUP_TIERS = frozenset({"buyer", "seller", "autoservice"})


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


def markup_percent_for_tier(
    tier: MarkupTier,
    settings_row: Optional[SiteSettings] = None,
) -> float:
    if tier == "buyer":
        return buyer_markup_percent(settings_row)
    if tier == "autoservice":
        return autoservice_markup_percent(settings_row)
    return global_markup_percent(settings_row)


def automatic_markup_tier(org: Optional[Organization]) -> MarkupTier:
    """Tier chosen automatically from organization type (no manual override)."""
    if org is not None and getattr(org, "is_autoservice", False):
        if not getattr(org, "autoservice_paused", False):
            return "autoservice"
    return "seller"


def org_markup_tier_override(org: Optional[Organization]) -> Optional[MarkupTier]:
    tier = getattr(org, "new_parts_markup_tier", None) if org is not None else None
    if tier in VALID_MARKUP_TIERS:
        return tier  # type: ignore[return-value]
    return None


def effective_markup_tier(org: Optional[Organization]) -> MarkupTier:
    override = org_markup_tier_override(org)
    if override is not None:
        return override
    return automatic_markup_tier(org)


def effective_markup_percent(
    org: Optional[Organization],
    settings_row: Optional[SiteSettings] = None,
) -> float:
    """Effective new-parts markup percent for an organization."""
    return markup_percent_for_tier(effective_markup_tier(org), settings_row)


def has_org_markup_override(org: Optional[Organization]) -> bool:
    return org_markup_tier_override(org) is not None


def sync_org_markup_from_global(db: Session, org: Organization, global_percent: float, *, force: bool) -> None:
    """Update org stored markup when not manual (or when force=True)."""
    if not force and (getattr(org, "new_parts_markup_manual", False) or has_org_markup_override(org)):
        return
    org.new_parts_markup_percent = float(global_percent)
    if force:
        org.new_parts_markup_manual = False
        org.new_parts_markup_tier = None


def apply_global_markup_to_organizations(
    db: Session,
    global_percent: float,
    *,
    skip_manual: bool,
) -> int:
    """Returns count of organizations updated."""
    query = db.query(Organization)
    if skip_manual:
        query = query.filter(
            Organization.new_parts_markup_manual.is_(False),
            Organization.new_parts_markup_tier.is_(None),
        )
    orgs = query.all()
    for org in orgs:
        org.new_parts_markup_percent = float(global_percent)
        if not skip_manual:
            org.new_parts_markup_manual = False
            org.new_parts_markup_tier = None
    return len(orgs)


def build_org_markup_info(org: Optional[Organization], settings_row: Optional[SiteSettings]) -> dict:
    tier_effective = effective_markup_tier(org)
    return {
        "tier_override": org_markup_tier_override(org),
        "tier_effective": tier_effective,
        "markup_percent": effective_markup_percent(org, settings_row),
        "buyer_markup_percent": buyer_markup_percent(settings_row),
        "seller_markup_percent": global_markup_percent(settings_row),
        "autoservice_markup_percent": autoservice_markup_percent(settings_row),
    }
