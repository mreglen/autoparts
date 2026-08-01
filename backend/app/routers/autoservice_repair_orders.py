from __future__ import annotations

from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_client import AutoserviceClient
from app.models.autoservice_settings import AutoserviceSettings
from app.models.garage_vehicle import GarageVehicle
from app.models.repair_order import (
    RepairOrder,
    RepairOrderClientPart,
    RepairOrderShopPart,
    RepairOrderWork,
)
from app.models.product import Product
from app.models.user import User
from app.schemas.repair_order import (
    ACTIVE_STATUSES,
    ALL_STATUSES,
    HISTORY_STATUSES,
    RepairOrderClientBrief,
    RepairOrderClientPartIn,
    RepairOrderClientPartView,
    RepairOrderClientShopPartView,
    RepairOrderClientView,
    RepairOrderClientWorkView,
    RepairOrderCreate,
    RepairOrderLiftsMeta,
    RepairOrderShopPartIn,
    RepairOrderShopPartView,
    RepairOrderStaffOption,
    RepairOrderStaffView,
    RepairOrderStatusPatch,
    RepairOrderUpdate,
    RepairOrderUserBrief,
    RepairOrderVehicleBrief,
    RepairOrderWorkIn,
    RepairOrderWorkView,
    WarehouseProductOption,
)
from app.utils.autoservice_access import (
    require_autoservice_staff,
    require_my_active_autoservice_client,
    user_display_name,
)
from app.utils.repair_order_number import allocate_repair_order_number

router = APIRouter(tags=["Autoservice repair orders"])

_TWOPLACES = Decimal("0.01")


def _money(value: Decimal | int | float | str) -> Decimal:
    return Decimal(str(value)).quantize(_TWOPLACES, rounding=ROUND_HALF_UP)


def _line_sum(qty: int, unit_price: Decimal | int | float | str) -> Decimal:
    return _money(Decimal(qty) * _money(unit_price))


def _price_with_markup(
    unit_price: Decimal | int | float | str,
    markup_percent: Decimal | int | float | str,
) -> Decimal:
    price = _money(unit_price)
    markup = Decimal(str(markup_percent))
    return _money(price * (Decimal("1") + markup / Decimal("100")))


def _shop_line_sum(
    qty: int,
    unit_price: Decimal | int | float | str,
    markup_percent: Decimal | int | float | str,
) -> Decimal:
    return _money(Decimal(qty) * _price_with_markup(unit_price, markup_percent))


def _user_brief(user: User) -> RepairOrderUserBrief:
    return RepairOrderUserBrief(id=user.id, name=user_display_name(user))


def _vehicle_brief(vehicle: GarageVehicle) -> RepairOrderVehicleBrief:
    return RepairOrderVehicleBrief(
        id=vehicle.id,
        make=vehicle.make,
        model=vehicle.model,
        year=vehicle.year,
        vin=vehicle.vin,
        plate=vehicle.plate,
    )


def _client_brief(client: AutoserviceClient) -> RepairOrderClientBrief:
    return RepairOrderClientBrief(id=client.id, name=client.name, phone=client.phone)


def _sorted_works(row: RepairOrder) -> list[RepairOrderWork]:
    return sorted(row.works or [], key=lambda w: (w.position, w.id))


def _sorted_client_parts(row: RepairOrder) -> list[RepairOrderClientPart]:
    return sorted(row.client_parts or [], key=lambda p: (p.position, p.id))


def _sorted_shop_parts(row: RepairOrder) -> list[RepairOrderShopPart]:
    return sorted(row.shop_parts or [], key=lambda p: (p.position, p.id))


def _work_view(work: RepairOrderWork) -> RepairOrderWorkView:
    return RepairOrderWorkView(
        id=work.id,
        position=work.position,
        title=work.title,
        qty=work.qty,
        unit_price=_money(work.unit_price),
        line_sum=_line_sum(work.qty, work.unit_price),
        executor_user_id=work.executor_user_id,
        executor=_user_brief(work.executor) if work.executor else None,
    )


def _client_work_view(work: RepairOrderWork) -> RepairOrderClientWorkView:
    return RepairOrderClientWorkView(
        id=work.id,
        position=work.position,
        title=work.title,
        qty=work.qty,
        unit_price=_money(work.unit_price),
        line_sum=_line_sum(work.qty, work.unit_price),
    )


def _client_part_view(part: RepairOrderClientPart) -> RepairOrderClientPartView:
    return RepairOrderClientPartView(
        id=part.id,
        position=part.position,
        title=part.title,
        qty=part.qty,
    )


def _shop_part_view(part: RepairOrderShopPart) -> RepairOrderShopPartView:
    unit = _money(part.unit_price)
    markup = _money(part.markup_percent)
    price_marked = _price_with_markup(unit, markup)
    return RepairOrderShopPartView(
        id=part.id,
        position=part.position,
        title=part.title,
        qty=part.qty,
        unit_price=unit,
        markup_percent=markup,
        price_with_markup=price_marked,
        line_sum=_shop_line_sum(part.qty, unit, markup),
        source=part.source,
        product_id=part.product_id,
        rossko_brand=part.rossko_brand,
        rossko_partnumber=part.rossko_partnumber,
    )


def _client_shop_part_view(part: RepairOrderShopPart) -> RepairOrderClientShopPartView:
    unit = _money(part.unit_price)
    markup = _money(part.markup_percent)
    price_marked = _price_with_markup(unit, markup)
    return RepairOrderClientShopPartView(
        id=part.id,
        position=part.position,
        title=part.title,
        qty=part.qty,
        price_with_markup=price_marked,
        line_sum=_shop_line_sum(part.qty, unit, markup),
    )


def _to_staff_view(row: RepairOrder) -> RepairOrderStaffView:
    works = [_work_view(w) for w in _sorted_works(row)]
    parts = [_client_part_view(p) for p in _sorted_client_parts(row)]
    shop = [_shop_part_view(p) for p in _sorted_shop_parts(row)]
    works_total = _money(sum((w.line_sum for w in works), Decimal("0.00")))
    shop_total = _money(sum((p.line_sum for p in shop), Decimal("0.00")))
    return RepairOrderStaffView(
        id=row.id,
        organization_id=row.organization_id,
        order_number=row.order_number,
        client_id=row.client_id,
        vehicle_id=row.vehicle_id,
        client_comment=row.client_comment,
        staff_comment=row.staff_comment,
        lift_number=row.lift_number,
        scheduled_at=row.scheduled_at,
        accepted_by_user_id=row.accepted_by_user_id,
        status=row.status,
        created_at=row.created_at,
        updated_at=row.updated_at,
        client=_client_brief(row.client),
        vehicle=_vehicle_brief(row.vehicle),
        accepted_by=_user_brief(row.accepted_by),
        assignees=[_user_brief(u) for u in (row.assignees or [])],
        works=works,
        client_parts=parts,
        shop_parts=shop,
        works_total=works_total,
        shop_parts_total=shop_total,
        grand_total=_money(works_total + shop_total),
    )


def _to_client_view(row: RepairOrder) -> RepairOrderClientView:
    works = [_client_work_view(w) for w in _sorted_works(row)]
    parts = [_client_part_view(p) for p in _sorted_client_parts(row)]
    shop = [_client_shop_part_view(p) for p in _sorted_shop_parts(row)]
    works_total = _money(sum((w.line_sum for w in works), Decimal("0.00")))
    shop_total = _money(sum((p.line_sum for p in shop), Decimal("0.00")))
    return RepairOrderClientView(
        id=row.id,
        order_number=row.order_number,
        vehicle_id=row.vehicle_id,
        client_comment=row.client_comment,
        lift_number=row.lift_number,
        scheduled_at=row.scheduled_at,
        status=row.status,
        created_at=row.created_at,
        vehicle=_vehicle_brief(row.vehicle),
        works=works,
        client_parts=parts,
        shop_parts=shop,
        works_total=works_total,
        shop_parts_total=shop_total,
        grand_total=_money(works_total + shop_total),
    )


def _order_query(db: Session):
    return db.query(RepairOrder).options(
        joinedload(RepairOrder.client),
        joinedload(RepairOrder.vehicle),
        joinedload(RepairOrder.accepted_by),
        joinedload(RepairOrder.assignees),
        selectinload(RepairOrder.works).joinedload(RepairOrderWork.executor),
        selectinload(RepairOrder.client_parts),
        selectinload(RepairOrder.shop_parts),
    )


def _get_org_order_or_404(db: Session, org_id: str, order_id: int) -> RepairOrder:
    row = (
        _order_query(db)
        .filter(RepairOrder.id == order_id, RepairOrder.organization_id == org_id)
        .first()
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запись не найдена",
        )
    return row


def _get_client_and_vehicle(
    db: Session,
    org_id: str,
    client_id: int,
    vehicle_id: int,
) -> tuple[AutoserviceClient, GarageVehicle]:
    client = (
        db.query(AutoserviceClient)
        .filter(
            AutoserviceClient.id == client_id,
            AutoserviceClient.organization_id == org_id,
            AutoserviceClient.status == "active",
        )
        .first()
    )
    if not client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Клиент не найден",
        )
    vehicle = (
        db.query(GarageVehicle)
        .filter(
            GarageVehicle.id == vehicle_id,
            GarageVehicle.client_id == client_id,
            GarageVehicle.organization_id == org_id,
        )
        .first()
    )
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Автомобиль не найден у этого клиента",
        )
    return client, vehicle


def _resolve_assignees(db: Session, org_id: str, user_ids: list[int]) -> list[User]:
    if not user_ids:
        return []
    unique_ids = list(dict.fromkeys(user_ids))
    users = (
        db.query(User)
        .filter(
            User.id.in_(unique_ids),
            User.organization_id == org_id,
        )
        .all()
    )
    if len(users) != len(unique_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некоторые исполнители не найдены в организации",
        )
    for u in users:
        if not (u.is_admin or u.is_director or u.is_seller or u.is_employee):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Пользователь {u.id} не является сотрудником",
            )
    return users


def _resolve_executor(db: Session, org_id: str, user_id: int | None) -> User | None:
    if user_id is None:
        return None
    users = _resolve_assignees(db, org_id, [user_id])
    return users[0]


def _replace_works(
    db: Session,
    order: RepairOrder,
    org_id: str,
    items: list[RepairOrderWorkIn],
) -> None:
    order.works.clear()
    db.flush()
    for idx, item in enumerate(items, start=1):
        title = item.title.strip()
        if not title:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Название работы не может быть пустым",
            )
        _resolve_executor(db, org_id, item.executor_user_id)
        order.works.append(
            RepairOrderWork(
                position=idx,
                title=title[:255],
                qty=item.qty,
                unit_price=_money(item.unit_price),
                executor_user_id=item.executor_user_id,
            )
        )


def _replace_client_parts(
    order: RepairOrder,
    items: list[RepairOrderClientPartIn],
) -> None:
    order.client_parts.clear()
    for idx, item in enumerate(items, start=1):
        title = item.title.strip()
        if not title:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Название запчасти клиента не может быть пустым",
            )
        order.client_parts.append(
            RepairOrderClientPart(
                position=idx,
                title=title[:255],
                qty=item.qty,
            )
        )


def _validate_shop_part_product(
    db: Session,
    org_id: str,
    source: str,
    product_id: int | None,
) -> int | None:
    if source != "warehouse":
        return None
    if not product_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Для позиции со склада нужен product_id",
        )
    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.organization_id == org_id)
        .first()
    )
    if not product:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Товар склада не найден в организации",
        )
    return product.id


def _replace_shop_parts(
    db: Session,
    order: RepairOrder,
    org_id: str,
    items: list[RepairOrderShopPartIn],
) -> None:
    order.shop_parts.clear()
    db.flush()
    for idx, item in enumerate(items, start=1):
        title = item.title.strip()
        if not title:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Название запчасти исполнителя не может быть пустым",
            )
        product_id = _validate_shop_part_product(db, org_id, item.source, item.product_id)
        brand = (item.rossko_brand or "").strip() or None
        partnumber = (item.rossko_partnumber or "").strip() or None
        if item.source != "rossko":
            brand = None
            partnumber = None
        order.shop_parts.append(
            RepairOrderShopPart(
                position=idx,
                title=title[:255],
                qty=item.qty,
                unit_price=_money(item.unit_price),
                markup_percent=_money(item.markup_percent),
                source=item.source,
                product_id=product_id,
                rossko_brand=brand[:120] if brand else None,
                rossko_partnumber=partnumber[:120] if partnumber else None,
            )
        )


def _apply_search_filter(query, q: str | None):
    if not q or not q.strip():
        return query
    term = f"%{q.strip()}%"
    return query.filter(
        or_(
            RepairOrder.order_number.ilike(term),
            RepairOrder.client.has(AutoserviceClient.name.ilike(term)),
            RepairOrder.vehicle.has(
                or_(
                    GarageVehicle.make.ilike(term),
                    GarageVehicle.model.ilike(term),
                    GarageVehicle.vin.ilike(term),
                    GarageVehicle.plate.ilike(term),
                )
            ),
        )
    )


def _get_lifts_count(db: Session, org_id: str) -> int:
    row = (
        db.query(AutoserviceSettings)
        .filter(AutoserviceSettings.organization_id == org_id)
        .first()
    )
    if not row:
        return 0
    return max(int(row.lifts_count or 0), 0)


def _validate_lift_number(db: Session, org_id: str, lift_number: int | None) -> int | None:
    if lift_number is None:
        return None
    lifts_count = _get_lifts_count(db, org_id)
    if lifts_count <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Подъёмники не настроены (количество = 0)",
        )
    if not isinstance(lift_number, int) or lift_number < 1 or lift_number > lifts_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Номер подъёмника должен быть от 1 до {lifts_count}",
        )
    return lift_number


@router.get(
    "/autoservice/repair-orders/lifts-meta",
    response_model=RepairOrderLiftsMeta,
)
def get_repair_order_lifts_meta(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    return RepairOrderLiftsMeta(lifts_count=_get_lifts_count(db, org_id))


@router.get(
    "/autoservice/repair-orders/warehouse-products",
    response_model=list[WarehouseProductOption],
)
def search_warehouse_products(
    q: str = Query("", max_length=120),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    term = (q or "").strip()
    query = db.query(Product).filter(Product.organization_id == org_id)
    if term:
        like = f"%{term}%"
        query = query.filter(
            or_(
                Product.name.ilike(like),
                Product.article.ilike(like),
                Product.internal_code.ilike(like),
                Product.brand.ilike(like),
            )
        )
    rows = query.order_by(Product.name.asc(), Product.id.asc()).limit(20).all()
    return [
        WarehouseProductOption(
            id=p.id,
            title=(p.name or p.article or p.internal_code or f"Товар {p.id}")[:255],
            price=_money(p.price or 0),
            article=p.article,
            internal_code=p.internal_code,
        )
        for p in rows
    ]


@router.get(
    "/autoservice/repair-orders/staff-options",
    response_model=list[RepairOrderStaffOption],
)
def list_repair_order_staff_options(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    users = (
        db.query(User)
        .filter(
            User.organization_id == org_id,
            or_(
                User.is_admin.is_(True),
                User.is_director.is_(True),
                User.is_seller.is_(True),
                User.is_employee.is_(True),
            ),
        )
        .order_by(User.last_name.asc(), User.first_name.asc(), User.id.asc())
        .all()
    )
    return [RepairOrderStaffOption(id=u.id, name=user_display_name(u)) for u in users]


@router.get("/autoservice/repair-orders/me", response_model=list[RepairOrderClientView])
def list_my_repair_orders(
    scope: str = Query("active"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = require_my_active_autoservice_client(db, current_user)
    if scope not in ("active", "history", "all"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="scope должен быть active, history или all",
        )
    query = _order_query(db).filter(RepairOrder.client_id == client.id)
    if scope == "active":
        query = query.filter(RepairOrder.status.in_(ACTIVE_STATUSES))
    elif scope == "history":
        query = query.filter(RepairOrder.status.in_(HISTORY_STATUSES))
    rows = query.order_by(RepairOrder.scheduled_at.desc(), RepairOrder.id.desc()).all()
    return [_to_client_view(row) for row in rows]


@router.get("/autoservice/repair-orders", response_model=list[RepairOrderStaffView])
def list_repair_orders(
    scope: str = Query("active"),
    q: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    if scope not in ("active", "history"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="scope должен быть active или history",
        )
    query = _order_query(db).filter(RepairOrder.organization_id == org_id)
    if scope == "active":
        query = query.filter(RepairOrder.status.in_(ACTIVE_STATUSES))
    else:
        if status_filter:
            if status_filter not in HISTORY_STATUSES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Для истории status: issued или cancelled",
                )
            query = query.filter(RepairOrder.status == status_filter)
        else:
            query = query.filter(RepairOrder.status.in_(HISTORY_STATUSES))
    query = _apply_search_filter(query, q)
    rows = query.order_by(RepairOrder.scheduled_at.desc(), RepairOrder.id.desc()).all()
    return [_to_staff_view(row) for row in rows]


@router.get(
    "/autoservice/repair-orders/{order_id}",
    response_model=RepairOrderStaffView,
)
def get_repair_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    row = _get_org_order_or_404(db, org_id, order_id)
    return _to_staff_view(row)


@router.post(
    "/autoservice/repair-orders",
    response_model=RepairOrderStaffView,
    status_code=status.HTTP_201_CREATED,
)
def create_repair_order(
    payload: RepairOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    _get_client_and_vehicle(db, org_id, payload.client_id, payload.vehicle_id)
    assignees = _resolve_assignees(db, org_id, payload.assignee_user_ids)
    scheduled_at = payload.scheduled_at
    if isinstance(scheduled_at, datetime) and scheduled_at.tzinfo is not None:
        scheduled_at = scheduled_at.replace(tzinfo=None)

    lift_number = _validate_lift_number(db, org_id, payload.lift_number)
    row = RepairOrder(
        organization_id=org_id,
        order_number=allocate_repair_order_number(db),
        client_id=payload.client_id,
        vehicle_id=payload.vehicle_id,
        client_comment=(payload.client_comment or "").strip() or None,
        staff_comment=(payload.staff_comment or "").strip() or None,
        lift_number=lift_number,
        scheduled_at=scheduled_at,
        accepted_by_user_id=current_user.id,
        status="accepted",
    )
    row.assignees = assignees
    db.add(row)
    db.flush()
    _replace_works(db, row, org_id, payload.works)
    _replace_client_parts(row, payload.client_parts)
    _replace_shop_parts(db, row, org_id, payload.shop_parts)
    db.commit()
    row = _get_org_order_or_404(db, org_id, row.id)
    return _to_staff_view(row)


@router.patch(
    "/autoservice/repair-orders/{order_id}",
    response_model=RepairOrderStaffView,
)
def update_repair_order(
    order_id: int,
    payload: RepairOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    row = _get_org_order_or_404(db, org_id, order_id)

    client_id = payload.client_id if payload.client_id is not None else row.client_id
    vehicle_id = payload.vehicle_id if payload.vehicle_id is not None else row.vehicle_id
    if payload.client_id is not None or payload.vehicle_id is not None:
        _get_client_and_vehicle(db, org_id, client_id, vehicle_id)
        row.client_id = client_id
        row.vehicle_id = vehicle_id

    if payload.scheduled_at is not None:
        scheduled_at = payload.scheduled_at
        if scheduled_at.tzinfo is not None:
            scheduled_at = scheduled_at.replace(tzinfo=None)
        row.scheduled_at = scheduled_at

    if "client_comment" in payload.model_fields_set:
        comment = payload.client_comment
        row.client_comment = (comment or "").strip() or None

    if "staff_comment" in payload.model_fields_set:
        staff_comment = payload.staff_comment
        row.staff_comment = (staff_comment or "").strip() or None

    if "lift_number" in payload.model_fields_set:
        row.lift_number = _validate_lift_number(db, org_id, payload.lift_number)

    if payload.assignee_user_ids is not None:
        row.assignees = _resolve_assignees(db, org_id, payload.assignee_user_ids)

    if "works" in payload.model_fields_set and payload.works is not None:
        _replace_works(db, row, org_id, payload.works)

    if "client_parts" in payload.model_fields_set and payload.client_parts is not None:
        _replace_client_parts(row, payload.client_parts)

    if "shop_parts" in payload.model_fields_set and payload.shop_parts is not None:
        _replace_shop_parts(db, row, org_id, payload.shop_parts)

    db.commit()
    row = _get_org_order_or_404(db, org_id, order_id)
    return _to_staff_view(row)


@router.patch(
    "/autoservice/repair-orders/{order_id}/status",
    response_model=RepairOrderStaffView,
)
def patch_repair_order_status(
    order_id: int,
    payload: RepairOrderStatusPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    row = _get_org_order_or_404(db, org_id, order_id)
    if payload.status not in ALL_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недопустимый статус",
        )
    row.status = payload.status
    db.commit()
    row = _get_org_order_or_404(db, org_id, order_id)
    return _to_staff_view(row)
