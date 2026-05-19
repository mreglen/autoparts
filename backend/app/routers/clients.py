from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload
from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.client import Client as ClientModel
from app.models.garage_used_orders import GarageUsedOrder
from app.models.garage_new_orders import GarageNewOrder
from app.schemas.client import (
    ClientCreate,
    ClientUpdate,
    ClientResponse,
    ClientListItemResponse,
    ClientBuyerOrdersResponse,
    ClientOrderGroupResponse,
    ClientOrderItemResponse,
)
from typing import List, Optional
from app.utils.phone import normalize_to_storage_format
from app.utils.client_buyers import buyer_key, merge_buyer_from_order, order_matches_buyer

router = APIRouter(prefix="/clients", tags=["Clients"])

ORDER_TYPE_LABELS = {
    "used": "Б/у запчасти",
    "new": "Новые запчасти",
}


def _require_organization_id(user: User) -> str:
    if not user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Организация не указана",
        )
    return user.organization_id


def _collect_buyers_with_orders(db: Session, organization_id: str) -> dict:
    buyers: dict = {}

    used_orders = (
        db.query(GarageUsedOrder)
        .filter(GarageUsedOrder.organization_id == organization_id)
        .all()
    )
    for order in used_orders:
        merge_buyer_from_order(buyers, order)

    new_orders = (
        db.query(GarageNewOrder)
        .filter(GarageNewOrder.organization_id == organization_id)
        .all()
    )
    for order in new_orders:
        merge_buyer_from_order(buyers, order)

    clients_in_org = (
        db.query(ClientModel)
        .filter(ClientModel.organization_id == organization_id)
        .all()
    )
    for client in clients_in_org:
        key = buyer_key(client.email, client.phone)
        if not key or key not in buyers:
            continue
        buyers[key]["id"] = client.id
        buyers[key]["last_name"] = client.last_name
        buyers[key]["first_name"] = client.first_name
        buyers[key]["patronymic"] = client.patronymic
        buyers[key]["email"] = client.email
        buyers[key]["phone"] = client.phone

    return buyers


@router.get("", response_model=List[ClientListItemResponse])
def get_clients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clients who placed at least one order with the seller organization."""
    organization_id = _require_organization_id(current_user)
    buyers = _collect_buyers_with_orders(db, organization_id)
    org_name = current_user.organization.name if current_user.organization else None

    result = []
    for buyer in buyers.values():
        result.append(
            ClientListItemResponse(
                id=buyer["id"],
                last_name=buyer["last_name"],
                first_name=buyer["first_name"],
                patronymic=buyer["patronymic"],
                email=buyer["email"],
                phone=buyer["phone"],
                organization_id=organization_id,
                organization_name=org_name,
                orders_count=buyer["orders_count"],
            )
        )

    result.sort(
        key=lambda c: (
            (c.last_name or "").lower(),
            (c.first_name or "").lower(),
            (c.email or "").lower(),
        )
    )
    return result


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

    if client_id is not None:
        client = (
            db.query(ClientModel)
            .filter(
                ClientModel.id == client_id,
                ClientModel.organization_id == organization_id,
            )
            .first()
        )
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        target_email = client.email
        target_phone = client.phone
        buyer_name = client.full_name
    else:
        if not email or not phone:
            raise HTTPException(
                status_code=400,
                detail="Укажите client_id или email и phone",
            )
        target_email = email
        target_phone = phone
        buyer_name = email

    used_orders = (
        db.query(GarageUsedOrder)
        .options(selectinload(GarageUsedOrder.items))
        .filter(GarageUsedOrder.organization_id == organization_id)
        .order_by(GarageUsedOrder.created_at.desc())
        .all()
    )
    new_orders = (
        db.query(GarageNewOrder)
        .options(selectinload(GarageNewOrder.items))
        .filter(GarageNewOrder.organization_id == organization_id)
        .order_by(GarageNewOrder.created_at.desc())
        .all()
    )

    groups: list[ClientOrderGroupResponse] = []

    for order in used_orders:
        if not order_matches_buyer(order, target_email, target_phone):
            continue
        if not buyer_name or buyer_name == target_email:
            buyer_name = order.buyer_name or buyer_name
        groups.append(
            ClientOrderGroupResponse(
                id=order.id,
                order_type="used",
                order_type_label=ORDER_TYPE_LABELS["used"],
                status_code=order.status_code,
                total_amount=float(order.total_amount or 0),
                is_paid=bool(order.is_paid),
                created_at=order.created_at,
                items=[
                    ClientOrderItemResponse(
                        id=item.id,
                        product_id=item.product_id,
                        name=item.name,
                        brand=item.brand,
                        partnumber=item.partnumber,
                        quantity=item.quantity,
                        price=float(item.price or 0),
                        status_code=item.status_code,
                        order_type="used",
                        order_id=order.id,
                    )
                    for item in (order.items or [])
                ],
            )
        )

    for order in new_orders:
        if not order_matches_buyer(order, target_email, target_phone):
            continue
        if not buyer_name or buyer_name == target_email:
            buyer_name = order.buyer_name or buyer_name
        groups.append(
            ClientOrderGroupResponse(
                id=order.id,
                order_type="new",
                order_type_label=ORDER_TYPE_LABELS["new"],
                status_code=order.status_code,
                total_amount=float(order.total_amount or 0),
                is_paid=bool(order.is_paid),
                created_at=order.created_at,
                items=[
                    ClientOrderItemResponse(
                        id=item.id,
                        product_id=None,
                        name=item.name,
                        brand=item.brand,
                        partnumber=item.partnumber,
                        quantity=item.quantity,
                        price=float(item.price or 0),
                        status_code=item.status_code,
                        order_type="new",
                        order_id=order.id,
                    )
                    for item in (order.items or [])
                ],
            )
        )

    groups.sort(key=lambda g: g.created_at, reverse=True)

    return ClientBuyerOrdersResponse(
        buyer_name=buyer_name,
        buyer_email=target_email,
        buyer_phone=target_phone,
        orders=groups,
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
