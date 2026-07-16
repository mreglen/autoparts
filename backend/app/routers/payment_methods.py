from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.payment_method import PaymentMethod, organization_payment_methods
from app.models.organization import Organization
from app.models.user import User
from app.core.auth import get_current_user
from app.schemas.payment_method import PaymentMethodCreate, PaymentMethodResponse

router = APIRouter(prefix="/payment-methods", tags=["Payment Methods"])


@router.get("/", response_model=List[PaymentMethodResponse])
def get_all_payment_methods(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(PaymentMethod).order_by(PaymentMethod.id).all()


@router.post("/", response_model=PaymentMethodResponse)
def create_payment_method(
    payment_method: PaymentMethodCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create payment methods",
        )

    existing = (
        db.query(PaymentMethod)
        .filter(
            (PaymentMethod.code == payment_method.code)
            | (PaymentMethod.name == payment_method.name)
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment method with this code or name already exists",
        )

    db_payment_method = PaymentMethod(**payment_method.dict())
    db.add(db_payment_method)
    db.commit()
    db.refresh(db_payment_method)
    return db_payment_method


@router.get("/by-organization/{organization_id}", response_model=List[PaymentMethodResponse])
def get_payment_methods_by_organization(
    organization_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    if current_user.organization_id != organization_id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this organization",
        )

    return (
        db.query(PaymentMethod)
        .join(Organization.payment_methods)
        .filter(Organization.id == organization_id)
        .order_by(PaymentMethod.id)
        .all()
    )


@router.post("/assign-to-org")
def assign_payment_method_to_org(
    organization_id: str,
    payment_method_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    if current_user.organization_id != organization_id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this organization",
        )

    payment_method = (
        db.query(PaymentMethod).filter(PaymentMethod.id == payment_method_id).first()
    )
    if not payment_method:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment method not found",
        )

    existing = db.execute(
        organization_payment_methods.select().where(
            organization_payment_methods.c.organization_id == organization_id,
            organization_payment_methods.c.payment_method_id == payment_method_id,
        )
    ).fetchone()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment method is already assigned to this organization",
        )

    db.execute(
        organization_payment_methods.insert().values(
            organization_id=organization_id,
            payment_method_id=payment_method_id,
        )
    )
    db.commit()
    return {"message": "Payment method assigned to organization successfully"}


@router.delete("/remove-from-org/{organization_id}/{payment_method_id}")
def remove_payment_method_from_org(
    organization_id: str,
    payment_method_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    if current_user.organization_id != organization_id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this organization",
        )

    payment_method = (
        db.query(PaymentMethod).filter(PaymentMethod.id == payment_method_id).first()
    )
    if not payment_method:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment method not found",
        )

    result = db.execute(
        organization_payment_methods.delete().where(
            organization_payment_methods.c.organization_id == organization_id,
            organization_payment_methods.c.payment_method_id == payment_method_id,
        )
    )

    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment method is not assigned to this organization",
        )

    db.commit()
    return {"message": "Payment method removed from organization successfully"}
