"""Admin access helpers for operating on a seller's organization."""
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.user import User
from app.models.organization import Organization


def get_seller_or_404(db: Session, seller_id: int) -> User:
    seller = (
        db.query(User)
        .options(joinedload(User.organization))
        .filter(User.id == seller_id, User.is_seller.is_(True))
        .first()
    )
    if not seller:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Продавец не найден")
    return seller


def get_seller_organization(db: Session, seller_id: int) -> tuple[User, Organization]:
    seller = get_seller_or_404(db, seller_id)
    if not seller.organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="У продавца не указана организация",
        )
    org = seller.organization
    if org is None:
        org = db.query(Organization).filter(Organization.id == seller.organization_id).first()
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Организация не найдена")
    return seller, org
