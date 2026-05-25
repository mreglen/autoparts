import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.organization import Organization as OrganizationModel
from app.models.product import Product as ProductModel
from app.schemas.public_organization import PublicOrganizationDetail, PublicOrganizationListItem

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Public organizations"])


def _public_org_filter(query):
    """Только организации с заполненным названием — для публичного каталога."""
    return query.filter(
        OrganizationModel.name.isnot(None),
        func.length(func.trim(OrganizationModel.name)) > 0,
    )


def _catalog_product_filter(query):
    return query.filter(func.coalesce(ProductModel.quantity, 0) > 0)


def _build_public_org(
    org: OrganizationModel,
    *,
    has_catalog_items: bool = False,
) -> PublicOrganizationListItem:
    return PublicOrganizationListItem(
        id=org.id,
        name=(org.name or "").strip(),
        address=(org.address or "").strip() or None,
        phone=org.phone,
        logo_organization=org.logo_organization,
        description=(org.description or "").strip() or None,
        has_catalog_items=has_catalog_items,
    )


def _catalog_flags_by_org(db: Session, org_ids: list[str]) -> dict[str, bool]:
    if not org_ids:
        return {}
    rows = (
        db.query(ProductModel.organization_id)
        .filter(
            ProductModel.organization_id.in_(org_ids),
            func.coalesce(ProductModel.quantity, 0) > 0,
        )
        .distinct()
        .all()
    )
    return {str(row[0]): True for row in rows if row[0]}


@router.get("/public/organizations", response_model=list[PublicOrganizationListItem])
def list_public_organizations(db: Session = Depends(get_db)):
    try:
        orgs = (
            _public_org_filter(db.query(OrganizationModel))
            .order_by(OrganizationModel.name.asc(), OrganizationModel.id.asc())
            .all()
        )
        if not orgs:
            return []

        org_ids = [org.id for org in orgs]
        catalog_flags = _catalog_flags_by_org(db, org_ids)

        return [
            _build_public_org(org, has_catalog_items=catalog_flags.get(org.id, False))
            for org in orgs
        ]
    except Exception:
        logger.exception("list_public_organizations failed")
        raise HTTPException(status_code=500, detail="Не удалось загрузить список организаций")


@router.get("/public/organizations/{org_id}", response_model=PublicOrganizationDetail)
def get_public_organization(org_id: str, db: Session = Depends(get_db)):
    try:
        org = (
            _public_org_filter(db.query(OrganizationModel))
            .filter(OrganizationModel.id == org_id)
            .first()
        )
        if not org:
            raise HTTPException(status_code=404, detail="Организация не найдена")

        has_items = (
            _catalog_product_filter(
                db.query(ProductModel.id).filter(ProductModel.organization_id == org_id)
            )
            .first()
            is not None
        )

        return _build_public_org(org, has_catalog_items=has_items)
    except HTTPException:
        raise
    except Exception:
        logger.exception("get_public_organization failed org_id=%s", org_id)
        raise HTTPException(status_code=500, detail="Не удалось загрузить организацию")
