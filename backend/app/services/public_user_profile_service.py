from __future__ import annotations

from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.organization import Organization as OrganizationModel
from app.models.product import Product as ProductModel
from app.models.user import User as UserModel
from app.schemas.public_user import (
    ChatParticipantPublic,
    PublicBuyerProfile,
    PublicSellerProfile,
    PublicUserProfile,
)
from app.utils.user_avatar import avatar_public_url


def user_display_name(user: UserModel) -> str:
    parts = [user.first_name, user.last_name]
    name = " ".join(p for p in parts if p and str(p).strip()).strip()
    return name or "Пользователь"


def build_seller_profile_url(public_code: str, site_origin: str) -> str:
    return f"{site_origin.rstrip('/')}/seller/{public_code}"


def build_buyer_profile_url(public_code: str, site_origin: str) -> str:
    return f"{site_origin.rstrip('/')}/buyer/{public_code}"


def build_user_profile_url(public_code: str, site_origin: str) -> str:
    return f"{site_origin.rstrip('/')}/users/{public_code}"


def _normalize_public_code_lookup(public_code: str) -> str:
    """Код из URL: новый формат K482917 — в верхнем регистре; старые числовые — как в БД."""
    raw = (public_code or "").strip()
    if not raw:
        return ""
    if raw[0].isalpha():
        return raw.upper()
    return raw


def _get_user_by_public_code(db: Session, public_code: str) -> Optional[UserModel]:
    code = _normalize_public_code_lookup(public_code)
    if not code:
        return None
    return db.query(UserModel).filter(UserModel.public_code == code).first()


def _catalog_count_for_org(db: Session, org_id: str) -> int:
    return (
        db.query(func.count(ProductModel.id))
        .filter(
            ProductModel.organization_id == org_id,
            func.coalesce(ProductModel.quantity, 0) > 0,
        )
        .scalar()
        or 0
    )


def get_public_seller_profile(db: Session, public_code: str) -> Optional[PublicSellerProfile]:
    user = _get_user_by_public_code(db, public_code)
    if not user or not user.is_seller:
        return None

    org_name = None
    org_logo = None
    catalog_count = 0
    if user.organization_id:
        org = (
            db.query(OrganizationModel)
            .filter(OrganizationModel.id == user.organization_id)
            .first()
        )
        if org:
            org_name = (org.name or "").strip() or None
            org_logo = org.logo_organization
            catalog_count = _catalog_count_for_org(db, user.organization_id)

    return PublicSellerProfile(
        public_code=user.public_code,
        display_name=user_display_name(user),
        avatar_url=avatar_public_url(user.avatar_url),
        is_seller=True,
        is_buyer=bool(user.is_buyer),
        organization_id=user.organization_id,
        organization_name=org_name,
        organization_logo=org_logo,
        catalog_products_count=catalog_count,
    )


def get_public_user_profile(db: Session, public_code: str) -> Optional[PublicUserProfile]:
    user = _get_user_by_public_code(db, public_code)
    if not user:
        return None

    org_name = None
    org_logo = None
    catalog_count = 0
    if user.is_seller and user.organization_id:
        org = (
            db.query(OrganizationModel)
            .filter(OrganizationModel.id == user.organization_id)
            .first()
        )
        if org:
            org_name = (org.name or "").strip() or None
            org_logo = org.logo_organization
            catalog_count = _catalog_count_for_org(db, user.organization_id)

    return PublicUserProfile(
        user_id=user.id,
        public_code=user.public_code,
        display_name=user_display_name(user),
        avatar_url=avatar_public_url(user.avatar_url),
        is_seller=bool(user.is_seller),
        is_buyer=bool(user.is_buyer),
        organization_id=user.organization_id if user.is_seller else None,
        organization_name=org_name,
        organization_logo=org_logo,
        catalog_products_count=catalog_count,
    )


def get_public_buyer_profile(db: Session, public_code: str) -> Optional[PublicBuyerProfile]:
    user = _get_user_by_public_code(db, public_code)
    if not user or not user.is_buyer:
        return None

    return PublicBuyerProfile(
        public_code=user.public_code,
        display_name=user_display_name(user),
        avatar_url=avatar_public_url(user.avatar_url),
        is_seller=bool(user.is_seller),
        is_buyer=True,
    )


def participant_from_user(user: UserModel) -> ChatParticipantPublic:
    return ChatParticipantPublic(
        user_id=user.id,
        public_code=user.public_code,
        display_name=user_display_name(user),
        avatar_url=avatar_public_url(user.avatar_url),
        is_seller=bool(user.is_seller),
        is_buyer=bool(user.is_buyer),
    )
