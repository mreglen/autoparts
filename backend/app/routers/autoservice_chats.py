"""Чаты между клиентами автосервиса и сотрудниками организации."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_client import AutoserviceClient
from app.models.chat import Chat
from app.models.garage_vehicle import GarageVehicle
from app.models.inspection_booking import InspectionBooking
from app.models.repair_order import RepairOrder
from app.models.user import User
from app.routers.autoservice_clients import _client_view_with_account_email
from app.routers.chats import _build_chat_response
from app.schemas.autoservice_chat import (
    AutoserviceChatBookingBrief,
    AutoserviceChatClientBrief,
    AutoserviceChatClientProfile,
    AutoserviceChatOpenForClientIn,
    AutoserviceChatOrderBrief,
    AutoserviceChatParticipantAdd,
    AutoserviceChatTopics,
    AutoserviceChatVehicleBrief,
)
from app.schemas.chat import ChatResponse, ManageableUserItem
from app.services.autoservice_chat_service import (
    add_autoservice_chat_participant,
    can_manage_autoservice_chat,
    remove_autoservice_chat_participant,
    search_autoservice_chat_staff,
)
from app.services.organization_chat_service import CHAT_TYPE_AUTOSERVICE, _add_participant
from app.utils.autoservice_access import (
    AUTOSERVICE_PERMISSION_CHAT,
    find_active_autoservice_client_for_user,
    my_active_autoservice_client_cards,
    related_autoservice_client_ids,
    require_autoservice_enabled,
    require_autoservice_permission,
)
from app.utils.chat_access import (
    get_accessible_chat,
    get_chat_participant_ids,
    is_autoservice_chat,
)

router = APIRouter(tags=["Autoservice chats"])


class _StubUser:
    """Минимальный user-like объект для find_active_autoservice_client_for_user."""

    def __init__(self, user_id: int):
        self.id = user_id


def _resolve_client_card(db: Session, chat: Chat) -> AutoserviceClient | None:
    if chat.autoservice_client_id:
        return (
            db.query(AutoserviceClient)
            .filter(AutoserviceClient.id == chat.autoservice_client_id)
            .first()
        )
    if chat.buyer_id and chat.organization_id:
        return find_active_autoservice_client_for_user(db, _StubUser(chat.buyer_id), chat.organization_id)
    return None


def _staff_org_check(db: Session, chat: Chat, user: User) -> None:
    """Управлять участниками может только обладатель права autoservice.chat."""
    if not can_manage_autoservice_chat(db, chat, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нет права управлять доступом к чатам",
        )


def _require_autoservice_chat(db: Session, chat_id: int, user: User) -> Chat:
    chat = get_accessible_chat(db, chat_id, user.id)
    if not chat or not is_autoservice_chat(chat):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Чат не найден")
    return chat


def _vehicle_label(vehicle: GarageVehicle | None) -> str | None:
    if not vehicle:
        return None
    parts = [vehicle.make, vehicle.model]
    label = " ".join(p for p in parts if p).strip()
    if vehicle.year:
        label = f"{label}, {vehicle.year}".strip(", ")
    if vehicle.plate:
        label = f"{label} ({vehicle.plate})".strip()
    return label or None


@router.post("/autoservice/chats/open", response_model=ChatResponse)
def open_my_autoservice_chat(
    organization_id: str | None = Query(None, max_length=10),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Клиент: открыть (или создать) чат с автосервисом."""
    require_autoservice_enabled(db)
    cards = my_active_autoservice_client_cards(db, current_user)
    if organization_id:
        cards = [c for c in cards if c.organization_id == organization_id]
    if not cards:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступно только клиентам автосервиса",
        )
    if len(cards) > 1 and not organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="У вас несколько автосервисов — укажите organization_id",
        )
    client = cards[0]

    chat = (
        db.query(Chat)
        .filter(
            Chat.chat_type == CHAT_TYPE_AUTOSERVICE,
            Chat.organization_id == client.organization_id,
            Chat.autoservice_client_id == client.id,
            Chat.autoservice_booking_id.is_(None),
            Chat.autoservice_repair_order_id.is_(None),
            Chat.is_active == True,
        )
        .first()
    )
    if not chat:
        chat = Chat(
            chat_type=CHAT_TYPE_AUTOSERVICE,
            organization_id=client.organization_id,
            autoservice_client_id=client.id,
            buyer_id=current_user.id,
            title=client.name,
            is_active=True,
        )
        db.add(chat)
        db.flush()
        _add_participant(db, chat.id, current_user.id)
        db.commit()
        db.refresh(chat)
    return _build_chat_response(chat, db, current_user)


@router.get("/autoservice/chats/", response_model=list[ChatResponse])
def list_autoservice_chats(
    limit: int = Query(100, ge=1, le=300),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Сотрудник: все клиентские чаты своей организации."""
    org_id = require_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_CHAT)
    chats = (
        db.query(Chat)
        .filter(
            Chat.chat_type == CHAT_TYPE_AUTOSERVICE,
            Chat.organization_id == org_id,
            Chat.is_active == True,
        )
        .order_by(Chat.updated_at.desc())
        .limit(limit)
        .all()
    )
    return [_build_chat_response(chat, db, current_user) for chat in chats]


def _client_topics_rows(db: Session, organization_id: str, client: AutoserviceClient | None, client_user_id: int | None, limit: int = 200):
    """Авто, записи и заказ-наряды клиента (общая выборка для профиля и пикера контекста)."""
    related_ids: list[int] = []
    if client:
        related_ids = related_autoservice_client_ids(db, client, include_phone_matches=False)

    vehicles = []
    booking_rows = []
    order_rows = []
    if related_ids:
        vehicles = (
            db.query(GarageVehicle)
            .filter(
                GarageVehicle.organization_id == organization_id,
                GarageVehicle.client_id.in_(related_ids),
            )
            .order_by(GarageVehicle.id.desc())
            .all()
        )
        booking_rows = (
            db.query(InspectionBooking)
            .filter(
                InspectionBooking.organization_id == organization_id,
                or_(
                    InspectionBooking.client_id.in_(related_ids),
                    InspectionBooking.created_by_user_id == client_user_id,
                ),
            )
            .order_by(InspectionBooking.preferred_date.desc(), InspectionBooking.id.desc())
            .limit(limit)
            .all()
        )
        order_rows = (
            db.query(RepairOrder)
            .filter(
                RepairOrder.organization_id == organization_id,
                RepairOrder.client_id.in_(related_ids),
            )
            .order_by(RepairOrder.created_at.desc(), RepairOrder.id.desc())
            .limit(limit)
            .all()
        )
    return vehicles, booking_rows, order_rows


def _booking_brief(b, vehicle_labels: dict) -> AutoserviceChatBookingBrief:
    return AutoserviceChatBookingBrief(
        id=b.id,
        preferred_date=b.preferred_date,
        preferred_time=b.preferred_time,
        status=b.status,
        name=b.name,
        vehicle_label=vehicle_labels.get(b.garage_vehicle_id)
        or " ".join(p for p in (b.vehicle_make, b.vehicle_model) if p).strip()
        or None,
        source=b.source,
        created_at=b.created_at,
    )


def _order_brief(o, vehicle_labels: dict) -> AutoserviceChatOrderBrief:
    return AutoserviceChatOrderBrief(
        id=o.id,
        order_number=o.order_number,
        status=o.status,
        scheduled_at=o.scheduled_at,
        scheduled_end_at=o.scheduled_end_at,
        vehicle_label=vehicle_labels.get(o.vehicle_id),
        created_at=o.created_at,
    )


def _client_brief(client: AutoserviceClient) -> AutoserviceChatClientBrief:
    return AutoserviceChatClientBrief(
        id=client.id,
        name=client.name,
        phone=client.phone,
        user_id=client.user_id,
    )


@router.get("/autoservice/chats/clients", response_model=list[AutoserviceChatClientBrief])
def list_autoservice_chat_clients(
    q: str = Query("", max_length=120),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Сотрудник: клиенты организации для выбора при создании чата."""
    org_id = require_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_CHAT)
    query = db.query(AutoserviceClient).filter(AutoserviceClient.organization_id == org_id)
    term = (q or "").strip()
    if term:
        like = f"%{term}%"
        query = query.filter(
            or_(
                AutoserviceClient.name.ilike(like),
                AutoserviceClient.phone.ilike(like),
            )
        )
    rows = query.order_by(AutoserviceClient.name.asc()).limit(limit).all()
    return [_client_brief(c) for c in rows]


@router.get("/autoservice/chats/clients/{client_id}/topics", response_model=AutoserviceChatTopics)
def get_autoservice_chat_client_topics(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Сотрудник: записи на осмотр и заказ-наряды клиента для выбора контекста чата."""
    org_id = require_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_CHAT)
    client = (
        db.query(AutoserviceClient)
        .filter(
            AutoserviceClient.id == client_id,
            AutoserviceClient.organization_id == org_id,
        )
        .first()
    )
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Клиент не найден")

    vehicles, booking_rows, order_rows = _client_topics_rows(db, org_id, client, client.user_id, limit=30)
    vehicle_labels = {v.id: _vehicle_label(v) for v in vehicles}
    return AutoserviceChatTopics(
        client=_client_brief(client),
        bookings=[_booking_brief(b, vehicle_labels) for b in booking_rows],
        orders=[_order_brief(o, vehicle_labels) for o in order_rows],
    )


def _resolve_chat_client(
    db: Session,
    org_id: str,
    client_id: int | None,
    booking_id: int | None,
    repair_order_id: int | None,
) -> tuple[AutoserviceClient | None, InspectionBooking | None, RepairOrder | None]:
    """Определяет клиента и контекстный объект чата."""
    booking = None
    order = None
    if booking_id:
        booking = (
            db.query(InspectionBooking)
            .filter(
                InspectionBooking.id == booking_id,
                InspectionBooking.organization_id == org_id,
            )
            .first()
        )
        if not booking:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Запись не найдена")
    if repair_order_id:
        order = (
            db.query(RepairOrder)
            .filter(
                RepairOrder.id == repair_order_id,
                RepairOrder.organization_id == org_id,
            )
            .first()
        )
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заказ-наряд не найден")
    if booking_id and repair_order_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Укажите только один контекст чата",
        )

    client = None
    if client_id:
        client = (
            db.query(AutoserviceClient)
            .filter(
                AutoserviceClient.id == client_id,
                AutoserviceClient.organization_id == org_id,
            )
            .first()
        )
        if not client:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Клиент не найден")
    elif booking_id:
        booking_client_id = booking.client_id
        if not booking_client_id and booking.created_by_user_id:
            client = (
                db.query(AutoserviceClient)
                .filter(
                    AutoserviceClient.organization_id == org_id,
                    AutoserviceClient.user_id == booking.created_by_user_id,
                )
                .first()
            )
            booking_client_id = client.id if client else None
        if booking_client_id:
            client = (
                db.query(AutoserviceClient)
                .filter(
                    AutoserviceClient.id == booking_client_id,
                    AutoserviceClient.organization_id == org_id,
                )
                .first()
            )
    elif repair_order_id and order and order.client_id:
        client = (
            db.query(AutoserviceClient)
            .filter(
                AutoserviceClient.id == order.client_id,
                AutoserviceClient.organization_id == org_id,
            )
            .first()
        )
    if not client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не удалось определить клиента",
        )

    related_ids = related_autoservice_client_ids(db, client, include_phone_matches=False)
    if booking_id and booking.client_id not in related_ids and booking.created_by_user_id != client.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Запись не принадлежит клиенту",
        )
    if repair_order_id and order and order.client_id not in related_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Заказ-наряд не принадлежит клиенту",
        )
    return client, booking, order


@router.post("/autoservice/chats/open-for-client", response_model=ChatResponse)
def open_autoservice_chat_for_client(
    body: AutoserviceChatOpenForClientIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Сотрудник: открыть/создать чат с клиентом в контексте (общий / заказ-наряд / запись)."""
    org_id = require_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_CHAT)
    client, booking, order = _resolve_chat_client(
        db, org_id, body.client_id, body.booking_id, body.repair_order_id
    )
    if not client.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="У клиента нет аккаунта — чат недоступен",
        )

    query = db.query(Chat).filter(
        Chat.chat_type == CHAT_TYPE_AUTOSERVICE,
        Chat.organization_id == org_id,
        Chat.autoservice_client_id == client.id,
        Chat.is_active == True,
    )
    if booking:
        query = query.filter(
            Chat.autoservice_booking_id == booking.id,
            Chat.autoservice_repair_order_id.is_(None),
        )
    elif order:
        query = query.filter(
            Chat.autoservice_repair_order_id == order.id,
            Chat.autoservice_booking_id.is_(None),
        )
    else:
        query = query.filter(
            Chat.autoservice_booking_id.is_(None),
            Chat.autoservice_repair_order_id.is_(None),
        )
    chat = query.first()

    if not chat:
        chat = Chat(
            chat_type=CHAT_TYPE_AUTOSERVICE,
            organization_id=org_id,
            autoservice_client_id=client.id,
            autoservice_booking_id=booking.id if booking else None,
            autoservice_repair_order_id=order.id if order else None,
            buyer_id=client.user_id,
            title=client.name,
            is_active=True,
        )
        db.add(chat)
        db.flush()
        _add_participant(db, chat.id, client.user_id)
        _add_participant(db, chat.id, current_user.id)
        db.commit()
        db.refresh(chat)
    return _build_chat_response(chat, db, current_user)


@router.get("/autoservice/chats/{chat_id}/client-profile", response_model=AutoserviceChatClientProfile)
def get_chat_client_profile(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Профиль клиента чата: карточка, авто, записи, заказ-наряды."""
    chat = _require_autoservice_chat(db, chat_id, current_user)
    client = _resolve_client_card(db, chat)
    client_user_id = client.user_id if client else chat.buyer_id

    vehicles, booking_rows, order_rows = _client_topics_rows(
        db, chat.organization_id, client, client_user_id
    )
    vehicle_labels = {v.id: _vehicle_label(v) for v in vehicles}
    bookings = [_booking_brief(b, vehicle_labels) for b in booking_rows]
    orders = [_order_brief(o, vehicle_labels) for o in order_rows]

    return AutoserviceChatClientProfile(
        chat_id=chat.id,
        client=_client_view_with_account_email(db, client) if client else None,
        client_user_id=client_user_id,
        vehicles=[AutoserviceChatVehicleBrief.model_validate(v) for v in vehicles],
        bookings=bookings,
        orders=orders,
    )


@router.get("/autoservice/chats/{chat_id}/staff-candidates", response_model=list[ManageableUserItem])
def list_chat_staff_candidates(
    chat_id: int,
    q: str = Query("", max_length=120),
    limit: int = Query(30, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Сотрудники организации для добавления в чат."""
    chat = _require_autoservice_chat(db, chat_id, current_user)
    _staff_org_check(db, chat, current_user)

    rows = search_autoservice_chat_staff(db, chat, query=q, limit=limit)
    return [ManageableUserItem(**row) for row in rows]


@router.post("/autoservice/chats/{chat_id}/participants", status_code=status.HTTP_204_NO_CONTENT)
def add_chat_staff_participant(
    chat_id: int,
    body: AutoserviceChatParticipantAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chat = _require_autoservice_chat(db, chat_id, current_user)
    add_autoservice_chat_participant(db, chat, current_user, body.user_id)
    return None


@router.delete("/autoservice/chats/{chat_id}/participants/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_chat_staff_participant(
    chat_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chat = _require_autoservice_chat(db, chat_id, current_user)
    remove_autoservice_chat_participant(db, chat, current_user, user_id)
    return None


@router.get("/autoservice/chats/{chat_id}/participants", response_model=list[ManageableUserItem])
def list_chat_participants_staff(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Участники autoservice-чата (staff-сторона)."""
    chat = _require_autoservice_chat(db, chat_id, current_user)
    _staff_org_check(db, chat, current_user)

    ids = get_chat_participant_ids(db, chat.id)
    users = db.query(User).filter(User.id.in_(ids)).all() if ids else []
    return [
        ManageableUserItem(
            user_id=u.id,
            public_code=u.public_code,
            display_name=" ".join(p for p in (u.last_name, u.first_name, u.patronymic) if p).strip()
            or u.email
            or u.phone
            or f"ID {u.id}",
            avatar_url=u.avatar_url,
            organization_id=u.organization_id,
            is_seller=bool(u.is_seller),
            is_buyer=bool(chat.buyer_id and u.id == chat.buyer_id),
        )
        for u in users
    ]
