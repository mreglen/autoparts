from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.organization import Organization as OrganizationModel
from app.models.product import Product as ProductModel
from app.models.user import User as UserModel
from app.schemas.public_organization import PublicOrganizationDetail, PublicOrganizationListItem

router = APIRouter(tags=["Public organizations"])


def _build_public_org(
    org: OrganizationModel,
    *,
    products_count: int = 0,
    members_count: int = 0,
) -> PublicOrganizationListItem:
    return PublicOrganizationListItem(
        id=org.id,
        name=org.name,
        address=org.address,
        phone=org.phone,
        logo_organization=org.logo_organization,
        description=org.description,
        products_count=products_count,
        members_count=members_count,
    )


@router.get("/public/organizations", response_model=list[PublicOrganizationListItem])
def list_public_organizations(db: Session = Depends(get_db)):
    orgs = (
        db.query(OrganizationModel)
        .order_by(OrganizationModel.name.asc(), OrganizationModel.id.asc())
        .all()
    )
    if not orgs:
        return []

    org_ids = [org.id for org in orgs]

    product_counts = dict(
        db.query(ProductModel.organization_id, func.count(ProductModel.id))
        .filter(
            ProductModel.organization_id.in_(org_ids),
            ProductModel.quantity > 0,
        )
        .group_by(ProductModel.organization_id)
        .all()
    )
    member_counts = dict(
        db.query(UserModel.organization_id, func.count(UserModel.id))
        .filter(UserModel.organization_id.in_(org_ids))
        .group_by(UserModel.organization_id)
        .all()
    )

    return [
        _build_public_org(
            org,
            products_count=int(product_counts.get(org.id, 0)),
            members_count=int(member_counts.get(org.id, 0)),
        )
        for org in orgs
    ]


@router.get("/public/organizations/{org_id}", response_model=PublicOrganizationDetail)
def get_public_organization(org_id: str, db: Session = Depends(get_db)):
    org = db.query(OrganizationModel).filter(OrganizationModel.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Организация не найдена")

    products_count = (
        db.query(func.count(ProductModel.id))
        .filter(ProductModel.organization_id == org_id, ProductModel.quantity > 0)
        .scalar()
        or 0
    )
    members_count = (
        db.query(func.count(UserModel.id))
        .filter(UserModel.organization_id == org_id)
        .scalar()
        or 0
    )

    return _build_public_org(
        org,
        products_count=int(products_count),
        members_count=int(members_count),
    )
