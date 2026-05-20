"""Buyers and orders for a seller organization (shared by /clients and admin seller workspace)."""
from __future__ import annotations

from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.models.client import Client as ClientModel
from app.models.garage_new_orders import GarageNewOrder
from app.models.garage_used_orders import GarageUsedOrder
from app.schemas.client import (
    ClientBuyerOrdersResponse,
    ClientListItemResponse,
    ClientOrderGroupResponse,
    ClientOrderItemResponse,
)
from app.utils.client_buyers import buyer_key, merge_buyer_from_order, order_matches_buyer
from app.utils.phone import normalize_to_storage_format

ORDER_TYPE_LABELS = {
    "used": "Б/у запчасти",
    "new": "Новые запчасти",
}


def collect_buyers_with_orders(db: Session, organization_id: str) -> dict:
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


def list_buyers_for_organization(
    db: Session,
    organization_id: str,
    organization_name: Optional[str] = None,
) -> List[ClientListItemResponse]:
    buyers = collect_buyers_with_orders(db, organization_id)
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
                organization_name=organization_name,
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


def get_buyer_orders_for_organization(
    db: Session,
    organization_id: str,
    *,
    client_id: Optional[int] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
) -> ClientBuyerOrdersResponse:
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
