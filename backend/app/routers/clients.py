from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.client import Client as ClientModel
from app.models.organization import Organization as OrganizationModel
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse
from typing import List
from app.utils.phone import normalize_to_storage_format

router = APIRouter(prefix="/clients", tags=["Clients"])

@router.get("/", response_model=List[ClientResponse])
def get_clients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all clients for the current user's organization"""
    clients = db.query(ClientModel).filter(
        ClientModel.organization_id == current_user.organization_id
    ).all()
    
    # Add organization name to each client
    result = []
    for client in clients:
        client_dict = client.__dict__.copy()
        client_dict['organization_name'] = client.organization.name if client.organization else None
        result.append(client_dict)
    
    return result

@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(
    client: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new client for the current user's organization"""
    # Normalize phone number
    normalized_phone = normalize_to_storage_format(client.phone)
    if not normalized_phone:
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    # Check if client with this email already exists in the organization
    existing_client = db.query(ClientModel).filter(
        ClientModel.email == client.email,
        ClientModel.organization_id == client.organization_id
    ).first()
    
    if existing_client:
        raise HTTPException(
            status_code=400, 
            detail="Client with this email already exists in your organization"
        )
    
    # Check if client with this phone already exists in the organization
    existing_client_phone = db.query(ClientModel).filter(
        ClientModel.phone == normalized_phone,
        ClientModel.organization_id == client.organization_id
    ).first()
    
    if existing_client_phone:
        raise HTTPException(
            status_code=400, 
            detail="Client with this phone number already exists in your organization"
        )
    
    # Create new client
    db_client = ClientModel(
        last_name=client.last_name,
        first_name=client.first_name,
        patronymic=client.patronymic,
        email=client.email,
        phone=normalized_phone,
        organization_id=client.organization_id
    )
    
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    
    # Add organization name to response
    client_response = db_client.__dict__.copy()
    client_response['organization_name'] = db_client.organization.name if db_client.organization else None
    
    return client_response

@router.get("/{client_id}", response_model=ClientResponse)
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific client by ID (only if belongs to user's organization)"""
    client = db.query(ClientModel).filter(
        ClientModel.id == client_id,
        ClientModel.organization_id == current_user.organization_id
    ).first()
    
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Add organization name to response
    client_dict = client.__dict__.copy()
    client_dict['organization_name'] = client.organization.name if client.organization else None
    
    return client_dict

@router.put("/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: int,
    client_update: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a client (only if belongs to user's organization)"""
    db_client = db.query(ClientModel).filter(
        ClientModel.id == client_id,
        ClientModel.organization_id == current_user.organization_id
    ).first()
    
    if not db_client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Update fields
    update_data = client_update.dict(exclude_unset=True)
    if 'phone' in update_data:
        normalized_phone = normalize_to_storage_format(update_data['phone'])
        if not normalized_phone:
            raise HTTPException(status_code=400, detail="Invalid phone number format")
        update_data['phone'] = normalized_phone
    
    for key, value in update_data.items():
        setattr(db_client, key, value)
    
    db.commit()
    db.refresh(db_client)
    
    # Add organization name to response
    client_response = db_client.__dict__.copy()
    client_response['organization_name'] = db_client.organization.name if db_client.organization else None
    
    return client_response

@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a client (only if belongs to user's organization)"""
    db_client = db.query(ClientModel).filter(
        ClientModel.id == client_id,
        ClientModel.organization_id == current_user.organization_id
    ).first()
    
    if not db_client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    db.delete(db_client)
    db.commit()
    return