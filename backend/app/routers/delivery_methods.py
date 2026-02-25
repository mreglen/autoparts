from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.delivery_method import DeliveryMethod
from app.models.organization import Organization
from app.models.user import User
from app.core.auth import get_current_user
from app.schemas.delivery_method import DeliveryMethodCreate, DeliveryMethodResponse, OrganizationDeliveryMethodResponse

router = APIRouter(prefix="/delivery-methods", tags=["Delivery Methods"])


@router.get("/", response_model=List[DeliveryMethodResponse])
def get_all_delivery_methods(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all available delivery methods
    """
    delivery_methods = db.query(DeliveryMethod).all()
    return delivery_methods


@router.post("/", response_model=DeliveryMethodResponse)
def create_delivery_method(
    delivery_method: DeliveryMethodCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new delivery method (admin only)
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create delivery methods"
        )
    
    # Check if delivery method with this name already exists
    existing = db.query(DeliveryMethod).filter(DeliveryMethod.name == delivery_method.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Delivery method with this name already exists"
        )
    
    db_delivery_method = DeliveryMethod(**delivery_method.dict())
    db.add(db_delivery_method)
    db.commit()
    db.refresh(db_delivery_method)
    
    return db_delivery_method


@router.get("/by-organization/{organization_id}", response_model=List[DeliveryMethodResponse])
def get_delivery_methods_by_organization(
    organization_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all delivery methods assigned to an organization
    """
    # Check if user has access to this organization
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Verify user has access to this organization
    if current_user.organization_id != organization_id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this organization"
        )
    
    delivery_methods = db.query(DeliveryMethod)\
        .join(Organization.delivery_methods)\
        .filter(Organization.id == organization_id).all()
    
    return delivery_methods


@router.post("/assign-to-org")
def assign_delivery_method_to_org(
    organization_id: str,
    delivery_method_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Assign a delivery method to an organization
    """
    # Check if user has access to this organization
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Verify user has access to this organization
    if current_user.organization_id != organization_id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this organization"
        )
    
    # Check if delivery method exists
    delivery_method = db.query(DeliveryMethod).filter(DeliveryMethod.id == delivery_method_id).first()
    if not delivery_method:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Delivery method not found"
        )
    
    # Check if this combination already exists
    from app.models.delivery_method import organization_delivery_methods
    existing = db.execute(
        organization_delivery_methods.select().where(
            organization_delivery_methods.c.organization_id == organization_id,
            organization_delivery_methods.c.delivery_method_id == delivery_method_id
        )
    ).fetchone()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Delivery method is already assigned to this organization"
        )
    
    # Add the association
    db.execute(
        organization_delivery_methods.insert().values(
            organization_id=organization_id,
            delivery_method_id=delivery_method_id
        )
    )
    db.commit()
    
    return {"message": "Delivery method assigned to organization successfully"}


@router.delete("/remove-from-org/{organization_id}/{delivery_method_id}")
def remove_delivery_method_from_org(
    organization_id: str,
    delivery_method_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Remove a delivery method from an organization
    """
    # Check if user has access to this organization
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Verify user has access to this organization
    if current_user.organization_id != organization_id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this organization"
        )
    
    # Check if delivery method exists
    delivery_method = db.query(DeliveryMethod).filter(DeliveryMethod.id == delivery_method_id).first()
    if not delivery_method:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Delivery method not found"
        )
    
    # Remove the association
    from app.models.delivery_method import organization_delivery_methods
    result = db.execute(
        organization_delivery_methods.delete().where(
            organization_delivery_methods.c.organization_id == organization_id,
            organization_delivery_methods.c.delivery_method_id == delivery_method_id
        )
    )
    
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Delivery method is not assigned to this organization"
        )
    
    # Check if this organization still has at least one delivery method assigned
    remaining_methods = db.execute(
        organization_delivery_methods.select().where(
            organization_delivery_methods.c.organization_id == organization_id
        )
    ).fetchall()
    
    # If no delivery methods remain after removal, ensure the default one (ID=1) is assigned
    if len(remaining_methods) == 0:
        # Re-add the default delivery method (ID=1)
        default_delivery_method = db.query(DeliveryMethod).filter(DeliveryMethod.id == 1).first()
        if default_delivery_method:
            db.execute(
                organization_delivery_methods.insert().values(
                    organization_id=organization_id,
                    delivery_method_id=1
                )
            )
    
    db.commit()
    
    return {"message": "Delivery method removed from organization successfully"}


@router.delete("/reset-all-org-delivery-methods", status_code=204)
def reset_all_org_delivery_methods(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Reset all delivery method assignments for all organizations (admin only)
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can reset delivery method assignments"
        )
    
    from app.models.delivery_method import organization_delivery_methods
    db.execute(organization_delivery_methods.delete())
    db.commit()
    
    return {"message": "All delivery method assignments reset successfully"}


@router.post("/ensure-default-delivery-method/{method_id}")
def ensure_default_delivery_method(
    method_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Ensure that a specific delivery method is assigned to all organizations (admin only)
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can ensure default delivery method assignments"
        )
    
    from app.models.delivery_method import DeliveryMethod, organization_delivery_methods
    from app.models.organization import Organization
    
    # Check if the specified delivery method exists
    delivery_method = db.query(DeliveryMethod).filter(DeliveryMethod.id == method_id).first()
    if not delivery_method:
        raise HTTPException(
            status_code=404, 
            detail=f"Delivery method with ID {method_id} not found"
        )
    
    # Get all organizations
    organizations = db.query(Organization).all()
    
    # For each organization, check if the delivery method is assigned
    for org in organizations:
        # Check if this combination already exists
        existing = db.execute(
            organization_delivery_methods.select().where(
                organization_delivery_methods.c.organization_id == org.id,
                organization_delivery_methods.c.delivery_method_id == method_id
            )
        ).fetchone()
        
        if not existing:
            # Add the association
            db.execute(
                organization_delivery_methods.insert().values(
                    organization_id=org.id,
                    delivery_method_id=method_id
                )
            )
    
    db.commit()
    
    return {"message": f"Delivery method {method_id} ensured for all organizations"}


@router.post("/ensure-at-least-one-method/{org_id}")
def ensure_at_least_one_delivery_method(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Ensure that an organization has at least one delivery method assigned, defaulting to ID=1 if none are selected
    """
    # Check if user has access to this organization
    from app.models.organization import Organization
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Verify user has access to this organization
    if current_user.organization_id != org_id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this organization"
        )
    
    # Check how many delivery methods are currently assigned to this organization
    from app.models.delivery_method import organization_delivery_methods
    current_methods = db.execute(
        organization_delivery_methods.select().where(
            organization_delivery_methods.c.organization_id == org_id
        )
    ).fetchall()
    
    # If no delivery methods are assigned, assign the default one (ID=1)
    if len(current_methods) == 0:
        from app.models.delivery_method import DeliveryMethod
        default_delivery_method = db.query(DeliveryMethod).filter(DeliveryMethod.id == 1).first()
        if not default_delivery_method:
            raise HTTPException(
                status_code=404,
                detail="Default delivery method (ID=1) not found"
            )
        
        # Assign the default delivery method
        db.execute(
            organization_delivery_methods.insert().values(
                organization_id=org_id,
                delivery_method_id=1
            )
        )
        db.commit()
        
        return {"message": "Default delivery method (ID=1) assigned as no delivery methods were selected"}
    
    return {"message": f"Organization has {len(current_methods)} delivery method(s) assigned"}


@router.get("/validate-at-least-one/{org_id}")
def validate_at_least_one_delivery_method(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Validate that an organization has at least one delivery method assigned
    """
    # Check if user has access to this organization
    from app.models.organization import Organization
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Verify user has access to this organization
    if current_user.organization_id != org_id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this organization"
        )
    
    # Check how many delivery methods are currently assigned to this organization
    from app.models.delivery_method import organization_delivery_methods
    current_methods = db.execute(
        organization_delivery_methods.select().where(
            organization_delivery_methods.c.organization_id == org_id
        )
    ).fetchall()
    
    has_at_least_one = len(current_methods) > 0
    
    return {
        "has_at_least_one": has_at_least_one,
        "count": len(current_methods),
        "message": f"Organization has {len(current_methods)} delivery method(s) assigned" if has_at_least_one else "Organization has no delivery methods assigned"
    }


@router.post("/populate-default-delivery-methods")
def populate_default_delivery_methods(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Populate the organization_delivery_methods table for all organizations with the default delivery method (ID=1)
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can populate default delivery methods"
        )
    
    from app.models.delivery_method import DeliveryMethod, organization_delivery_methods
    from app.models.organization import Organization
    
    # Check if delivery method with ID=1 exists
    default_delivery_method = db.query(DeliveryMethod).filter(DeliveryMethod.id == 1).first()
    if not default_delivery_method:
        raise HTTPException(
            status_code=404, 
            detail="Default delivery method (ID=1) not found"
        )
    
    # Get all organizations
    organizations = db.query(Organization).all()
    
    populated_count = 0
    
    # For each organization, check if the default delivery method is assigned
    for org in organizations:
        # Check if this combination already exists
        existing = db.execute(
            organization_delivery_methods.select().where(
                organization_delivery_methods.c.organization_id == org.id,
                organization_delivery_methods.c.delivery_method_id == 1
            )
        ).fetchone()
        
        if not existing:
            # Add the association
            db.execute(
                organization_delivery_methods.insert().values(
                    organization_id=org.id,
                    delivery_method_id=1
                )
            )
            populated_count += 1
    
    db.commit()
    
    return {
        "message": f"Default delivery method (ID=1) assigned to {populated_count} organization(s) that didn't have it",
        "total_organizations": len(organizations)
    }