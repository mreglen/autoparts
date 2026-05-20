from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.client import Client as ClientModel
from app.schemas.client import (
    ClientCreate,
    ClientUpdate,
    ClientResponse,
    ClientListItemResponse,
    ClientBuyerOrdersResponse,
)
from typing import List, Optional
from app.utils.phone import normalize_to_storage_format
from app.services.organization_clients import (
    get_buyer_orders_for_organization,
    list_buyers_for_organization,
)

router = APIRouter(prefix="/clients", tags=["Clients"])


def _require_organization_id(user: User) -> str:
    if not user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Организация не указана",
        )
    return user.organization_id


@router.get("", response_model=List[ClientListItemResponse])
def get_clients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clients who placed at least one order with the seller organization."""
    organization_id = _require_organization_id(current_user)
    org_name = current_user.organization.name if current_user.organization else None
    return list_buyers_for_organization(db, organization_id, org_name)


@router.get("/buyer-orders", response_model=ClientBuyerOrdersResponse)
def get_client_buyer_orders(
    client_id: Optional[int] = Query(None),
    email: Optional[str] = Query(None),
    phone: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Orders of a buyer for the current organization, grouped by order."""
    organization_id = _require_organization_id(current_user)
    return get_buyer_orders_for_organization(
        db,
        organization_id,
        client_id=client_id,
        email=email,
        phone=phone,
    )


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(
    client: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new client for the current user's organization"""
    normalized_phone = normalize_to_storage_format(client.phone)
    if not normalized_phone:
        raise HTTPException(status_code=400, detail="Invalid phone number format")

    existing_client = db.query(ClientModel).filter(
        ClientModel.email == client.email,
        ClientModel.organization_id == client.organization_id,
    ).first()

    if existing_client:
        raise HTTPException(
            status_code=400,
            detail="Client with this email already exists in your organization",
        )

    existing_client_phone = db.query(ClientModel).filter(
        ClientModel.phone == normalized_phone,
        ClientModel.organization_id == client.organization_id,
    ).first()

    if existing_client_phone:
        raise HTTPException(
            status_code=400,
            detail="Client with this phone number already exists in your organization",
        )

    db_client = ClientModel(
        last_name=client.last_name,
        first_name=client.first_name,
        patronymic=client.patronymic,
        email=client.email,
        phone=normalized_phone,
        organization_id=client.organization_id,
    )

    db.add(db_client)
    db.commit()
    db.refresh(db_client)

    client_response = db_client.__dict__.copy()
    client_response["organization_name"] = (
        db_client.organization.name if db_client.organization else None
    )

    return client_response


@router.get("/{client_id}", response_model=ClientResponse)
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific client by ID (only if belongs to user's organization)"""
    organization_id = _require_organization_id(current_user)
    client = db.query(ClientModel).filter(
        ClientModel.id == client_id,
        ClientModel.organization_id == organization_id,
    ).first()

    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    client_dict = client.__dict__.copy()
    client_dict["organization_name"] = client.organization.name if client.organization else None

    return client_dict


@router.put("/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: int,
    client_update: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a client (only if belongs to user's organization)"""
    organization_id = _require_organization_id(current_user)
    db_client = db.query(ClientModel).filter(
        ClientModel.id == client_id,
        ClientModel.organization_id == organization_id,
    ).first()

    if not db_client:
        raise HTTPException(status_code=404, detail="Client not found")

    update_data = client_update.dict(exclude_unset=True)
    if "phone" in update_data:
        normalized_phone = normalize_to_storage_format(update_data["phone"])
        if not normalized_phone:
            raise HTTPException(status_code=400, detail="Invalid phone number format")
        update_data["phone"] = normalized_phone

    for key, value in update_data.items():
        setattr(db_client, key, value)

    db.commit()
    db.refresh(db_client)

    client_response = db_client.__dict__.copy()
    client_response["organization_name"] = (
        db_client.organization.name if db_client.organization else None
    )

    return client_response


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a client (only if belongs to user's organization)"""
    organization_id = _require_organization_id(current_user)
    db_client = db.query(ClientModel).filter(
        ClientModel.id == client_id,
        ClientModel.organization_id == organization_id,
    ).first()

    if not db_client:
        raise HTTPException(status_code=404, detail="Client not found")

    db.delete(db_client)
    db.commit()
    return
