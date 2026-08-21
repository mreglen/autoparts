from __future__ import annotations

from datetime import datetime
from decimal import Decimal, ROUND_CEILING, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_client import AutoserviceClient
from app.models.autoservice_work_zone import AutoserviceWorkZone
from app.models.autoservice_service_employee import AutoserviceServiceEmployee
from app.models.organization_employee import OrganizationEmployee
from app.models.autoservice_work import AutoserviceWork
from app.models.garage_vehicle import GarageVehicle
from app.models.repair_order import (
    RepairOrder,
    RepairOrderClientPart,
    RepairOrderShopPart,
    RepairOrderWork,
    RepairOrderWorkExecutor,
)
from app.models.product import Product
from app.models.autoservice_warehouse import AutoserviceWarehouseItem
from app.models.user import User
from app.schemas.repair_order import (
    ACTIVE_STATUSES,
    ALL_STATUSES,
    HISTORY_STATUSES,
    REVIEW_STATUSES,
    RepairOrderAutoserviceStockImportIn,
    ManualShopPartUpdate,
    RepairOrderClientBrief,
    RepairOrderClientPartIn,
    RepairOrderClientPartView,
    RepairOrderClientShopPartView,
    RepairOrderClientView,
    RepairOrderClientWorkView,
    RepairOrderPurchaseImportIn,
    RepairOrderCreate,
    RepairOrderWorkZoneBrief,
    RepairOrderWorkZonesMeta,
    RepairOrderShopPartIn,
    RepairOrderShopPartView,
    RepairOrderEmployeeBrief,
    RepairOrderServiceEmployeeOption,
    RepairOrderStaffOption,
    RepairOrderStaffView,
    RepairOrderStatusPatch,
    RepairOrderUpdate,
    RepairOrderUserBrief,
    RepairOrderVehicleBrief,
    RepairOrderWorkExecutorIn,
    RepairOrderWorkExecutorView,
    RepairOrderWorkIn,
    RepairOrderWorkView,
    WarehouseProductOption,
)
from app.schemas.autoservice_finance import AutoservicePaymentIn
from app.utils.autoservice_access import (
    display_client_phone,
    related_autoservice_client_ids,
    require_my_active_autoservice_client,
    require_orders_access,
    user_display_name,
)
from app.utils.repair_order_number import allocate_repair_order_number
from app.services.autoservice_payroll import accrue_order_payroll, clear_order_accruals
from app.services.autoservice_payment_service import (
    batch_paid_amounts,
    create_repair_order_payment,
    ensure_order_fully_paid,
    order_payment_summary,
)
from app.services.repair_order_cart_import import shop_part_display_name
from app.services.repair_order_delete import delete_repair_order
from app.services.repair_order_purchase_import import (
    append_purchase_items_to_repair_order,
    detach_imported_shop_part_from_repair_order,
    shop_part_is_imported,
)
from app.services.repair_order_status_timestamps import record_repair_order_status_timestamp
from app.services.organization_employee_sync import service_employee_is_executor, user_is_service_executor
from app.services.repair_order_stock_reserve import (
    append_autoservice_stock_to_repair_order,
    apply_shop_part_reservation,
    release_order_reservations,
    release_shop_part_reservation,
    shop_part_stock_max_qty,
)
from app.services.autoservice_warehouse_service import (
    _receipt_doc_date,
    fulfill_autoservice_stock_on_order_complete,
    manual_receipt_for_shop_part,
    product_available_qty,
    ReceiptDocumentBatch,
    repair_order_receipt_doc_date,
    shop_part_is_manual_editable,
    update_manual_shop_part,
)
from app.services.autoservice_work_zone_helpers import (
    normalize_dt as _normalize_dt,
    validate_work_zone_id as _validate_work_zone_id,
    validate_schedule_end as _validate_schedule_end,
)

router = APIRouter(tags=["Autoservice repair orders"])

_TWOPLACES = Decimal("0.01")
_THREEPLACES = Decimal("0.001")


def _money(value: Decimal | int | float | str) -> Decimal:
    return Decimal(str(value)).quantize(_TWOPLACES, rounding=ROUND_HALF_UP)


def _qty(value: Decimal | int | float | str) -> Decimal:
    return Decimal(str(value)).quantize(_THREEPLACES, rounding=ROUND_HALF_UP)


def _line_sum(qty: int, unit_price: Decimal | int | float | str) -> Decimal:
    return _money(Decimal(qty) * _money(unit_price))


def _price_with_markup(
    unit_price: Decimal | int | float | str,
    markup_percent: Decimal | int | float | str,
    *,
    ceil_rubles: bool = True,
) -> Decimal:
    price = _money(unit_price)
    markup = Decimal(str(markup_percent))
    result = price * (Decimal("1") + markup / Decimal("100"))
    if ceil_rubles:
        return result.quantize(Decimal("1"), rounding=ROUND_CEILING).quantize(_TWOPLACES)
    return _money(result)


def _effective_shop_unit_price(part: RepairOrderShopPart) -> Decimal:
    override = getattr(part, "client_unit_price_override", None)
    if override is not None:
        return _money(override)
    return _price_with_markup(
        part.unit_price,
        part.markup_percent,
    )


def _shop_line_sum(
    qty: Decimal | int | float | str,
    client_unit_price: Decimal | int | float | str,
) -> Decimal:
    return _money(_qty(qty) * _money(client_unit_price))


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
    return RepairOrderClientBrief(
        id=client.id,
        name=client.name,
        phone=display_client_phone(client.phone),
        email=client.email,
        user_id=client.user_id,
        person_type=client.person_type or "individual",
        legal_name=client.legal_name,
        address=client.address,
        inn=client.inn,
        kpp=client.kpp,
        ogrn=client.ogrn,
    )


def _sorted_works(row: RepairOrder) -> list[RepairOrderWork]:
    return sorted(row.works or [], key=lambda w: (w.position, w.id))


def _sorted_client_parts(row: RepairOrder) -> list[RepairOrderClientPart]:
    return sorted(row.client_parts or [], key=lambda p: (p.position, p.id))


def _sorted_shop_parts(row: RepairOrder) -> list[RepairOrderShopPart]:
    return sorted(row.shop_parts or [], key=lambda p: (p.position, p.id))


def _employee_brief(employee: AutoserviceServiceEmployee) -> RepairOrderEmployeeBrief:
    return RepairOrderEmployeeBrief(id=employee.id, name=employee.name)


def _work_view(work: RepairOrderWork) -> RepairOrderWorkView:
    line_total = _line_sum(work.qty, work.unit_price)
    executors = []
    for row in sorted(work.executors or [], key=lambda e: e.id):
        pay = _money(line_total * _money(row.percent) / Decimal("100"))
        executors.append(
            RepairOrderWorkExecutorView(
                employee_id=row.employee_id,
                employee=_employee_brief(row.employee),
                percent=_money(row.percent),
                pay_amount=pay,
            )
        )
    return RepairOrderWorkView(
        id=work.id,
        position=work.position,
        catalog_work_id=work.catalog_work_id,
        title=work.title,
        qty=work.qty,
        unit_price=_money(work.unit_price),
        line_sum=line_total,
        executors=executors,
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
        unit=getattr(part, "unit", None) or "pcs",
    )


def _shop_part_view(
    part: RepairOrderShopPart,
    *,
    db: Session | None = None,
    org_id: str | None = None,
) -> RepairOrderShopPartView:
    unit = _money(part.unit_price)
    markup = _money(part.markup_percent)
    price_marked = _effective_shop_unit_price(part)
    qty = _qty(part.qty)
    display = shop_part_display_name(
        title=part.title,
        brand=part.brand,
        partnumber=part.partnumber,
        rossko_brand=part.rossko_brand,
        rossko_partnumber=part.rossko_partnumber,
    )
    return RepairOrderShopPartView(
        id=part.id,
        position=part.position,
        title=part.title,
        display_name=display,
        qty=qty,
        unit=part.unit or "pcs",
        unit_price=unit,
        markup_percent=markup,
        client_unit_price_override=(
            _money(part.client_unit_price_override)
            if part.client_unit_price_override is not None
            else None
        ),
        price_with_markup=price_marked,
        line_sum=_shop_line_sum(qty, price_marked),
        source=part.source,
        product_id=part.product_id,
        autoservice_stock_item_id=getattr(part, "autoservice_stock_item_id", None),
        brand=part.brand,
        partnumber=part.partnumber,
        rossko_brand=part.rossko_brand,
        rossko_partnumber=part.rossko_partnumber,
        is_imported=shop_part_is_imported(part),
        is_manual_editable=(
            shop_part_is_manual_editable(db, org_id=org_id, part=part)
            if db is not None and org_id
            else False
        ),
        stock_max_qty=(
            shop_part_stock_max_qty(db, org_id, part)
            if db is not None and org_id
            else None
        ),
        receipt_date=(
            _receipt_doc_date(manual_receipt_for_shop_part(db, org_id=org_id, part=part))
            if db is not None and org_id
            else None
        ),
    )


def _client_shop_part_view(part: RepairOrderShopPart) -> RepairOrderClientShopPartView:
    unit = _money(part.unit_price)
    markup = _money(part.markup_percent)
    price_marked = _effective_shop_unit_price(part)
    qty = _qty(part.qty)
    display = shop_part_display_name(
        title=part.title,
        brand=part.brand,
        partnumber=part.partnumber,
        rossko_brand=part.rossko_brand,
        rossko_partnumber=part.rossko_partnumber,
    )
    return RepairOrderClientShopPartView(
        id=part.id,
        position=part.position,
        title=part.title,
        display_name=display,
        qty=qty,
        unit=part.unit or "pcs",
        price_with_markup=price_marked,
        line_sum=_shop_line_sum(qty, price_marked),
    )


def _work_zone_brief(zone: AutoserviceWorkZone | None) -> RepairOrderWorkZoneBrief | None:
    if not zone:
        return None
    return RepairOrderWorkZoneBrief(id=zone.id, name=zone.name, sort_order=zone.sort_order)


def _order_grand_total(row: RepairOrder) -> Decimal:
    works = [_work_view(w) for w in _sorted_works(row)]
    shop = [_shop_part_view(p) for p in _sorted_shop_parts(row)]
    works_total = _money(sum((w.line_sum for w in works), Decimal("0.00")))
    shop_total = _money(sum((p.line_sum for p in shop), Decimal("0.00")))
    return _money(works_total + shop_total)


def _to_staff_view(
    db: Session,
    row: RepairOrder,
    *,
    paid_amount: Decimal | None = None,
) -> RepairOrderStaffView:
    works = [_work_view(w) for w in _sorted_works(row)]
    parts = [_client_part_view(p) for p in _sorted_client_parts(row)]
    shop = [
        _shop_part_view(p, db=db, org_id=row.organization_id)
        for p in _sorted_shop_parts(row)
    ]
    works_total = _money(sum((w.line_sum for w in works), Decimal("0.00")))
    shop_total = _money(sum((p.line_sum for p in shop), Decimal("0.00")))
    grand_total = _money(works_total + shop_total)
    if paid_amount is None:
        paid, remaining, is_paid = order_payment_summary(db, row, grand_total)
    else:
        paid = _money(paid_amount)
        remaining = _money(max(Decimal("0.00"), grand_total - paid))
        is_paid = remaining <= Decimal("0.00")
    return RepairOrderStaffView(
        id=row.id,
        organization_id=row.organization_id,
        order_number=row.order_number,
        client_id=row.client_id,
        vehicle_id=row.vehicle_id,
        client_comment=row.client_comment,
        staff_comment=row.staff_comment,
        work_zone_id=row.work_zone_id,
        work_zone=_work_zone_brief(row.work_zone),
        scheduled_at=row.scheduled_at,
        scheduled_end_at=row.scheduled_end_at,
        shipping_date=row.shipping_date,
        mileage_km=row.mileage_km,
        accepted_by_user_id=row.accepted_by_user_id,
        created_by_user_id=row.created_by_user_id,
        status=row.status,
        created_at=row.created_at,
        updated_at=row.updated_at,
        client=_client_brief(row.client),
        vehicle=_vehicle_brief(row.vehicle),
        accepted_by=_user_brief(row.accepted_by),
        created_by=_user_brief(row.created_by) if row.created_by else None,
        assignees=[_user_brief(u) for u in (row.assignees or [])],
        works=works,
        client_parts=parts,
        shop_parts=shop,
        works_total=works_total,
        shop_parts_total=shop_total,
        grand_total=grand_total,
        paid_amount=paid,
        remaining_amount=remaining,
        is_paid=is_paid,
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
        work_zone_id=row.work_zone_id,
        work_zone=_work_zone_brief(row.work_zone),
        scheduled_at=row.scheduled_at,
        scheduled_end_at=row.scheduled_end_at,
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
        joinedload(RepairOrder.created_by),
        joinedload(RepairOrder.work_zone),
        joinedload(RepairOrder.assignees),
        selectinload(RepairOrder.works).joinedload(RepairOrderWork.executor),
        selectinload(RepairOrder.works)
        .selectinload(RepairOrderWork.executors)
        .joinedload(RepairOrderWorkExecutor.employee),
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


def _require_full_orders(db: Session, user: User) -> str:
    org_id, level = require_orders_access(db, user)
    if level != "full":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нет доступа к этому разделу автосервиса",
        )
    return org_id


def _assert_own_order_visible(row: RepairOrder, current_user: User, level: str) -> None:
    if level == "full":
        return
    owner_id = row.created_by_user_id or row.accepted_by_user_id
    if owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запись не найдена",
        )


def _get_visible_order_or_404(
    db: Session,
    org_id: str,
    order_id: int,
    current_user: User,
    level: str,
) -> RepairOrder:
    row = _get_org_order_or_404(db, org_id, order_id)
    _assert_own_order_visible(row, current_user, level)
    return row


def _service_employee_id_for_user(db: Session, org_id: str, user_id: int) -> int | None:
    row = (
        db.query(OrganizationEmployee)
        .filter(
            OrganizationEmployee.organization_id == org_id,
            OrganizationEmployee.user_id == user_id,
            OrganizationEmployee.is_active.is_(True),
        )
        .first()
    )
    if not row or not row.legacy_service_employee_id:
        return None
    return row.legacy_service_employee_id


def _prepare_own_works(
    db: Session,
    org_id: str,
    user: User,
    works: list[RepairOrderWorkIn],
) -> list[RepairOrderWorkIn]:
    emp_id = _service_employee_id_for_user(db, org_id, user.id)
    prepared: list[RepairOrderWorkIn] = []
    for item in works:
        executors = (
            [RepairOrderWorkExecutorIn(employee_id=emp_id, percent=Decimal("100"))]
            if emp_id
            else []
        )
        prepared.append(
            item.model_copy(
                update={
                    "unit_price": Decimal("0.00"),
                    "executors": executors,
                    "executor_user_id": None,
                }
            )
        )
    return prepared


def _own_assignees(db: Session, org_id: str, user: User) -> list[User]:
    try:
        return _resolve_assignees(db, org_id, [user.id])
    except HTTPException:
        return []


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
    related_ids = related_autoservice_client_ids(db, client)
    vehicle = (
        db.query(GarageVehicle)
        .filter(
            GarageVehicle.id == vehicle_id,
            GarageVehicle.client_id.in_(related_ids),
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
        if not user_is_service_executor(db, u):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="В заказ-наряде можно указать только сотрудников автосервиса",
            )
    return users


def _resolve_executor(db: Session, org_id: str, user_id: int | None) -> User | None:
    if user_id is None:
        return None
    users = _resolve_assignees(db, org_id, [user_id])
    return users[0]


def _resolve_catalog_work(
    db: Session,
    org_id: str,
    catalog_work_id: int | None,
    title: str,
    unit_price: Decimal,
) -> tuple[int | None, str, Decimal]:
    if catalog_work_id is None:
        return None, title, unit_price
    row = (
        db.query(AutoserviceWork)
        .filter(
            AutoserviceWork.id == catalog_work_id,
            AutoserviceWork.organization_id == org_id,
            AutoserviceWork.is_active.is_(True),
        )
        .first()
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Работа из каталога не найдена",
        )
    resolved_title = title.strip() or row.name
    resolved_price = unit_price if unit_price > 0 else _money(row.default_unit_price)
    return row.id, resolved_title[:255], resolved_price


def _resolve_work_executors(
    db: Session,
    org_id: str,
    executors: list[RepairOrderWorkExecutorIn],
) -> list[tuple[AutoserviceServiceEmployee, Decimal]]:
    if not executors:
        return []
    ids = list(dict.fromkeys(e.employee_id for e in executors))
    employees = (
        db.query(AutoserviceServiceEmployee)
        .filter(
            AutoserviceServiceEmployee.id.in_(ids),
            AutoserviceServiceEmployee.organization_id == org_id,
            AutoserviceServiceEmployee.is_active.is_(True),
        )
        .all()
    )
    by_id = {e.id: e for e in employees}
    if len(by_id) != len(ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некоторые сотрудники сервиса не найдены",
        )
    for employee_id in ids:
        if not service_employee_is_executor(db, employee_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="В заказ-наряде можно указать только сотрудников автосервиса",
            )
    return [(by_id[item.employee_id], _money(item.percent)) for item in executors]


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
        if not title and not item.catalog_work_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Название работы не может быть пустым",
            )
        catalog_id, resolved_title, resolved_price = _resolve_catalog_work(
            db,
            org_id,
            item.catalog_work_id,
            title,
            _money(item.unit_price),
        )
        if not resolved_title:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Название работы не может быть пустым",
            )
        _resolve_executor(db, org_id, item.executor_user_id)
        executor_rows = _resolve_work_executors(db, org_id, item.executors)
        work = RepairOrderWork(
            position=idx,
            catalog_work_id=catalog_id,
            title=resolved_title[:255],
            qty=item.qty,
            unit_price=resolved_price,
            executor_user_id=item.executor_user_id,
        )
        for employee, percent in executor_rows:
            work.executors.append(
                RepairOrderWorkExecutor(
                    employee_id=employee.id,
                    percent=percent,
                )
            )
        order.works.append(work)


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
                unit=item.unit if item.unit in ("pcs", "l", "kg") else "pcs",
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


def _validate_autoservice_stock_item(
    db: Session,
    org_id: str,
    source: str,
    autoservice_stock_item_id: int | None,
) -> int | None:
    if source != "autoservice_stock":
        return None
    if not autoservice_stock_item_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Для позиции со склада автосервиса нужен autoservice_stock_item_id",
        )
    item = (
        db.query(AutoserviceWarehouseItem)
        .filter(
            AutoserviceWarehouseItem.id == autoservice_stock_item_id,
            AutoserviceWarehouseItem.organization_id == org_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Позиция склада автосервиса не найдена",
        )
    return item.id


def _apply_existing_shop_part_update(
    db: Session,
    part: RepairOrderShopPart,
    item: RepairOrderShopPartIn,
) -> None:
    title = item.title.strip()
    if not title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Название запчасти исполнителя не может быть пустым",
        )
    brand = (item.brand or item.rossko_brand or "").strip() or None
    partnumber = (item.partnumber or item.rossko_partnumber or "").strip() or None
    unit = item.unit if item.unit in ("pcs", "l", "kg") else "pcs"
    new_qty = _qty(item.qty)
    if part.qty != new_qty and part.source == "autoservice_stock":
        release_shop_part_reservation(db, part)
        part.qty = new_qty
        apply_shop_part_reservation(db, part)
    else:
        part.qty = new_qty
    part.title = title[:255]
    part.brand = brand[:120] if brand else None
    part.partnumber = partnumber[:120] if partnumber else None
    part.unit = unit
    part.unit_price = _money(item.unit_price)
    part.markup_percent = _money(item.markup_percent)
    part.client_unit_price_override = (
        _money(item.client_unit_price_override)
        if item.client_unit_price_override is not None
        else None
    )
    if item.source == "rossko":
        rossko_brand = (item.rossko_brand or "").strip() or None
        rossko_partnumber = (item.rossko_partnumber or "").strip() or None
        part.rossko_brand = rossko_brand[:120] if rossko_brand else None
        part.rossko_partnumber = rossko_partnumber[:120] if rossko_partnumber else None


def _replace_shop_parts(
    db: Session,
    order: RepairOrder,
    org_id: str,
    items: list[RepairOrderShopPartIn],
    user_id: int,
) -> None:
    imported_by_id = {
        part.id: part
        for part in (order.shop_parts or [])
        if shop_part_is_imported(part) and part.id is not None
    }
    existing_by_id = {
        part.id: part
        for part in (order.shop_parts or [])
        if part.id is not None and not shop_part_is_imported(part)
    }
    kept_part_ids: set[int] = set()

    manual_items: list[RepairOrderShopPartIn] = []
    for item in items:
        if item.id is not None and item.id in imported_by_id:
            imported_by_id[item.id].markup_percent = _money(item.markup_percent)
            imported_by_id[item.id].client_unit_price_override = (
                _money(item.client_unit_price_override)
                if item.client_unit_price_override is not None
                else None
            )
        elif item.id is not None and item.id in existing_by_id:
            _apply_existing_shop_part_update(db, existing_by_id[item.id], item)
            kept_part_ids.add(item.id)
        else:
            manual_items.append(item)

    removed_parts = [
        part for part in (order.shop_parts or [])
        if not shop_part_is_imported(part) and part.id not in kept_part_ids
    ]
    for part in removed_parts:
        if part.source in ("warehouse", "autoservice_stock"):
            release_shop_part_reservation(db, part)

    order.shop_parts[:] = [
        part for part in (order.shop_parts or [])
        if shop_part_is_imported(part) or part.id in kept_part_ids
    ]
    db.flush()

    receipt_batch = ReceiptDocumentBatch(
        db,
        org_id=org_id,
        user_id=user_id,
        repair_order_id=order.id,
        receipt_doc_date=repair_order_receipt_doc_date(order),
    )

    for item in manual_items:
        title = item.title.strip()
        if not title:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Название запчасти исполнителя не может быть пустым",
            )
        product_id = _validate_shop_part_product(db, org_id, item.source, item.product_id)
        autoservice_stock_item_id = _validate_autoservice_stock_item(
            db, org_id, item.source, item.autoservice_stock_item_id
        )
        brand = (item.brand or item.rossko_brand or "").strip() or None
        partnumber = (item.partnumber or item.rossko_partnumber or "").strip() or None
        rossko_brand = (item.rossko_brand or "").strip() or None
        rossko_partnumber = (item.rossko_partnumber or "").strip() or None
        if item.source != "rossko":
            rossko_brand = None
            rossko_partnumber = None
        unit = item.unit if item.unit in ("pcs", "l", "kg") else "pcs"
        source = item.source
        qty = _qty(item.qty)
        warehouse_receipt_id = None
        if source == "manual":
            saved_unit = item.unit if item.unit in ("pcs", "l", "kg") else "pcs"
            qty_dec = Decimal(str(qty or 1))
            if saved_unit == "pcs":
                qty_int = max(1, int(qty_dec.quantize(Decimal("1"))))
                qty = _qty(qty_int)
            else:
                qty = _qty(qty_dec)
                qty_int = max(1, int(qty_dec.quantize(Decimal("1"), rounding=ROUND_HALF_UP)))
            wh_item, receipt, _ = receipt_batch.add_manual(
                brand=brand or "",
                article=partnumber or "",
                name=title,
                quantity=qty_int,
                unit_price=_money(item.unit_price),
                unit=saved_unit,
            )
            source = "autoservice_stock"
            autoservice_stock_item_id = wh_item.id
            warehouse_receipt_id = receipt.id
            unit = saved_unit
            brand = (wh_item.brand or brand or "")[:120] or None
            partnumber = (wh_item.article or partnumber or "")[:120] or None
            product_id = None
        elif source == "warehouse":
            if not product_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Не указан товар склада «Мои запчасти»",
                )
            product = (
                db.query(Product)
                .filter(Product.id == product_id, Product.organization_id == org_id)
                .with_for_update()
                .first()
            )
            if not product:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Товар склада не найден",
                )
            qty_int = max(1, int(Decimal(str(qty or 1)).quantize(Decimal("1"))))
            wh_item, _, _ = receipt_batch.add_my_parts(
                product=product,
                brand=(product.brand or brand or "")[:120],
                article=(product.article or product.internal_code or partnumber or "")[:120],
                name=(product.name or title or "Запчасть")[:255],
                quantity=qty_int,
                unit_price=_money(item.unit_price or product.price or 0),
            )
            source = "autoservice_stock"
            autoservice_stock_item_id = wh_item.id
            product_id = None
            brand = (wh_item.brand or brand or "")[:120] or None
            partnumber = (wh_item.article or partnumber or "")[:120] or None
        new_part = RepairOrderShopPart(
            position=1,
            title=title[:255],
            brand=brand[:120] if brand else None,
            partnumber=partnumber[:120] if partnumber else None,
            qty=qty,
            unit=unit,
            unit_price=_money(item.unit_price),
            markup_percent=_money(item.markup_percent),
            client_unit_price_override=(
                _money(item.client_unit_price_override)
                if item.client_unit_price_override is not None
                else None
            ),
            source=source,
            product_id=product_id,
            autoservice_stock_item_id=autoservice_stock_item_id,
            warehouse_receipt_id=warehouse_receipt_id,
            rossko_brand=rossko_brand[:120] if rossko_brand else None,
            rossko_partnumber=rossko_partnumber[:120] if rossko_partnumber else None,
        )
        if source == "autoservice_stock":
            apply_shop_part_reservation(db, new_part)
        order.shop_parts.append(new_part)

    receipt_batch.flush()

    for idx, part in enumerate(order.shop_parts or [], start=1):
        part.position = idx


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


def _list_active_work_zones(db: Session, org_id: str) -> list[AutoserviceWorkZone]:
    return (
        db.query(AutoserviceWorkZone)
        .filter(
            AutoserviceWorkZone.organization_id == org_id,
            AutoserviceWorkZone.is_active.is_(True),
        )
        .order_by(AutoserviceWorkZone.sort_order.asc(), AutoserviceWorkZone.id.asc())
        .all()
    )


@router.get(
    "/autoservice/repair-orders/work-zones-meta",
    response_model=RepairOrderWorkZonesMeta,
)
def get_repair_order_work_zones_meta(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id, _level = require_orders_access(db, current_user)
    zones = _list_active_work_zones(db, org_id)
    return RepairOrderWorkZonesMeta(
        work_zones=[RepairOrderWorkZoneBrief.model_validate(z) for z in zones],
    )


@router.get(
    "/autoservice/repair-orders/warehouse-products",
    response_model=list[WarehouseProductOption],
)
def search_warehouse_products(
    q: str = Query("", max_length=120),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = _require_full_orders(db, current_user)
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
            brand=p.brand,
            internal_code=p.internal_code,
            available_qty=product_available_qty(p),
        )
        for p in rows
        if product_available_qty(p) > 0
    ]


@router.get(
    "/autoservice/repair-orders/service-employees-options",
    response_model=list[RepairOrderServiceEmployeeOption],
)
def list_repair_order_service_employee_options(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id, _level = require_orders_access(db, current_user)
    rows = (
        db.query(AutoserviceServiceEmployee)
        .join(
            OrganizationEmployee,
            OrganizationEmployee.legacy_service_employee_id == AutoserviceServiceEmployee.id,
        )
        .filter(
            AutoserviceServiceEmployee.organization_id == org_id,
            AutoserviceServiceEmployee.is_active.is_(True),
            OrganizationEmployee.is_service_executor.is_(True),
            OrganizationEmployee.is_active.is_(True),
        )
        .order_by(AutoserviceServiceEmployee.name.asc())
        .all()
    )
    return [
        RepairOrderServiceEmployeeOption(
            id=row.id,
            name=row.name,
            work_percent=_money(row.work_percent),
        )
        for row in rows
    ]


@router.get(
    "/autoservice/repair-orders/staff-options",
    response_model=list[RepairOrderStaffOption],
)
def list_repair_order_staff_options(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = _require_full_orders(db, current_user)
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


@router.get(
    "/autoservice/repair-orders/me/{order_id}",
    response_model=RepairOrderClientView,
)
def get_my_repair_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = require_my_active_autoservice_client(db, current_user)
    row = (
        _order_query(db)
        .filter(RepairOrder.id == order_id, RepairOrder.client_id == client.id)
        .first()
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ремонт не найден",
        )
    return _to_client_view(row)


@router.get("/autoservice/repair-orders", response_model=list[RepairOrderStaffView])
def list_repair_orders(
    scope: str = Query("active"),
    q: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    client_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id, level = require_orders_access(db, current_user)
    if scope not in ("active", "history", "all", "review"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="scope должен быть active, history, review или all",
        )
    if scope == "review" and level != "full":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нет доступа к проверке заказ-нарядов",
        )
    query = _order_query(db).filter(RepairOrder.organization_id == org_id)
    if level == "own":
        query = query.filter(
            (RepairOrder.created_by_user_id == current_user.id)
            | (
                (RepairOrder.created_by_user_id.is_(None))
                & (RepairOrder.accepted_by_user_id == current_user.id)
            )
        )
    if client_id is not None:
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
        query = query.filter(RepairOrder.client_id.in_(related_autoservice_client_ids(db, client)))
    if scope == "active":
        own_active = ACTIVE_STATUSES + REVIEW_STATUSES if level == "own" else ACTIVE_STATUSES
        query = query.filter(RepairOrder.status.in_(own_active))
    elif scope == "review":
        query = query.filter(RepairOrder.status.in_(REVIEW_STATUSES))
    elif scope == "history":
        if status_filter:
            if status_filter not in HISTORY_STATUSES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Для истории status: completed или cancelled",
                )
            query = query.filter(RepairOrder.status == status_filter)
        else:
            query = query.filter(RepairOrder.status.in_(HISTORY_STATUSES))
    query = _apply_search_filter(query, q)
    rows = query.order_by(RepairOrder.scheduled_at.desc(), RepairOrder.id.desc()).all()
    paid_map = batch_paid_amounts(db, [row.id for row in rows])
    return [
        _to_staff_view(db, row, paid_amount=paid_map.get(row.id, Decimal("0.00")))
        for row in rows
    ]


@router.get(
    "/autoservice/repair-orders/{order_id}",
    response_model=RepairOrderStaffView,
)
def get_repair_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id, level = require_orders_access(db, current_user)
    row = _get_visible_order_or_404(db, org_id, order_id, current_user, level)
    return _to_staff_view(db, row)


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
    org_id, level = require_orders_access(db, current_user)
    _get_client_and_vehicle(db, org_id, payload.client_id, payload.vehicle_id)
    is_own = level == "own"
    if is_own:
        scheduled_at = _normalize_dt(payload.scheduled_at) or datetime.utcnow()
        scheduled_end_at = None
        work_zone_id = None
        assignees = _own_assignees(db, org_id, current_user)
        works = _prepare_own_works(db, org_id, current_user, payload.works)
        shop_parts: list = []
        order_number = None
        initial_status = "review"
    else:
        if payload.scheduled_at is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Укажите дату записи",
            )
        scheduled_at = _normalize_dt(payload.scheduled_at)
        scheduled_end_at = _validate_schedule_end(scheduled_at, payload.scheduled_end_at)
        work_zone_id = _validate_work_zone_id(db, org_id, payload.work_zone_id)
        assignees = _resolve_assignees(db, org_id, payload.assignee_user_ids)
        works = payload.works
        shop_parts = payload.shop_parts
        order_number = allocate_repair_order_number(db, org_id)
        initial_status = "pending"
    row = RepairOrder(
        organization_id=org_id,
        order_number=order_number,
        client_id=payload.client_id,
        vehicle_id=payload.vehicle_id,
        client_comment=(payload.client_comment or "").strip() or None,
        staff_comment=(payload.staff_comment or "").strip() or None,
        work_zone_id=work_zone_id,
        scheduled_at=scheduled_at,
        scheduled_end_at=scheduled_end_at,
        shipping_date=None if is_own else payload.shipping_date,
        mileage_km=payload.mileage_km,
        accepted_by_user_id=current_user.id,
        created_by_user_id=current_user.id,
        status=initial_status,
    )
    record_repair_order_status_timestamp(row, initial_status)
    row.assignees = assignees
    db.add(row)
    db.flush()
    _replace_works(db, row, org_id, works)
    _replace_client_parts(row, payload.client_parts)
    if not is_own:
        _replace_shop_parts(db, row, org_id, shop_parts, current_user.id)
    db.commit()
    row = _get_org_order_or_404(db, org_id, row.id)
    return _to_staff_view(db, row)


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
    org_id, level = require_orders_access(db, current_user)
    row = _get_visible_order_or_404(db, org_id, order_id, current_user, level)
    is_own = level == "own"
    if is_own and row.status not in REVIEW_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="После одобрения заявку меняет приёмщик",
        )

    client_id = payload.client_id if payload.client_id is not None else row.client_id
    vehicle_id = payload.vehicle_id if payload.vehicle_id is not None else row.vehicle_id
    if payload.client_id is not None or payload.vehicle_id is not None:
        _get_client_and_vehicle(db, org_id, client_id, vehicle_id)
        row.client_id = client_id
        row.vehicle_id = vehicle_id

    if not is_own and payload.scheduled_at is not None:
        row.scheduled_at = _normalize_dt(payload.scheduled_at)

    if not is_own and "scheduled_end_at" in payload.model_fields_set:
        end_at = payload.scheduled_end_at
        row.scheduled_end_at = _validate_schedule_end(row.scheduled_at, end_at)

    if not is_own and "shipping_date" in payload.model_fields_set:
        row.shipping_date = payload.shipping_date

    if "mileage_km" in payload.model_fields_set:
        row.mileage_km = payload.mileage_km

    if "client_comment" in payload.model_fields_set:
        comment = payload.client_comment
        row.client_comment = (comment or "").strip() or None

    if "staff_comment" in payload.model_fields_set:
        staff_comment = payload.staff_comment
        row.staff_comment = (staff_comment or "").strip() or None

    if not is_own and "work_zone_id" in payload.model_fields_set:
        row.work_zone_id = _validate_work_zone_id(db, org_id, payload.work_zone_id)

    if not is_own and payload.assignee_user_ids is not None:
        row.assignees = _resolve_assignees(db, org_id, payload.assignee_user_ids)

    if "works" in payload.model_fields_set and payload.works is not None:
        works = (
            _prepare_own_works(db, org_id, current_user, payload.works)
            if is_own
            else payload.works
        )
        _replace_works(db, row, org_id, works)

    if "client_parts" in payload.model_fields_set and payload.client_parts is not None:
        _replace_client_parts(row, payload.client_parts)

    if not is_own and "shop_parts" in payload.model_fields_set and payload.shop_parts is not None:
        _replace_shop_parts(db, row, org_id, payload.shop_parts, current_user.id)

    db.commit()
    row = _get_org_order_or_404(db, org_id, order_id)
    return _to_staff_view(db, row)


@router.patch(
    "/autoservice/repair-orders/{order_id}/shop-parts/{part_id}/manual",
    response_model=RepairOrderShopPartView,
)
def update_manual_repair_order_shop_part(
    order_id: int,
    part_id: int,
    payload: ManualShopPartUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = _require_full_orders(db, current_user)
    _get_org_order_or_404(db, org_id, order_id)
    part = update_manual_shop_part(
        db,
        org_id=org_id,
        order_id=order_id,
        part_id=part_id,
        brand=payload.brand,
        article=payload.article,
        name=payload.name,
        quantity=payload.quantity,
        unit=payload.unit,
        unit_price=payload.unit_price,
        receipt_date=payload.receipt_date,
    )
    db.commit()
    return _shop_part_view(part, db=db, org_id=org_id)


@router.delete(
    "/autoservice/repair-orders/{order_id}/shop-parts/{part_id}/imported",
    response_model=RepairOrderStaffView,
)
def detach_imported_repair_order_shop_part(
    order_id: int,
    part_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = _require_full_orders(db, current_user)
    detach_imported_shop_part_from_repair_order(
        db,
        org_id=org_id,
        order_id=order_id,
        part_id=part_id,
    )
    db.commit()
    row = _get_org_order_or_404(db, org_id, order_id)
    return _to_staff_view(db, row)


@router.post(
    "/autoservice/repair-orders/{order_id}/purchase-items",
    response_model=RepairOrderStaffView,
)
def import_repair_order_purchase_items(
    order_id: int,
    payload: RepairOrderPurchaseImportIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = _require_full_orders(db, current_user)
    row = _get_org_order_or_404(db, org_id, order_id)
    append_purchase_items_to_repair_order(
        db,
        order=row,
        org_id=org_id,
        user=current_user,
        payload=payload,
    )
    db.commit()
    row = _get_org_order_or_404(db, org_id, order_id)
    return _to_staff_view(db, row)


@router.post(
    "/autoservice/repair-orders/{order_id}/autoservice-stock",
    response_model=RepairOrderStaffView,
)
def import_autoservice_stock_to_repair_order(
    order_id: int,
    payload: RepairOrderAutoserviceStockImportIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = _require_full_orders(db, current_user)
    row = _get_org_order_or_404(db, org_id, order_id)
    if row.status in HISTORY_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя добавлять запчасти в завершённый или отменённый заказ-наряд",
        )
    append_autoservice_stock_to_repair_order(
        db,
        order=row,
        org_id=org_id,
        items=[(entry.item_id, entry.qty) for entry in payload.items],
        markup_percent=payload.markup_percent,
    )
    db.commit()
    row = _get_org_order_or_404(db, org_id, order_id)
    return _to_staff_view(db, row)


@router.post(
    "/autoservice/repair-orders/{order_id}/approve",
    response_model=RepairOrderStaffView,
)
def approve_repair_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = _require_full_orders(db, current_user)
    row = _get_org_order_or_404(db, org_id, order_id)
    if row.status not in REVIEW_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Заявка уже не на проверке",
        )
    if not row.order_number:
        row.order_number = allocate_repair_order_number(db, org_id)
    row.status = "pending"
    row.accepted_by_user_id = current_user.id
    record_repair_order_status_timestamp(row, "pending")
    db.commit()
    row = _get_org_order_or_404(db, org_id, order_id)
    return _to_staff_view(db, row)


@router.delete(
    "/autoservice/repair-orders/{order_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_repair_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id, level = require_orders_access(db, current_user)
    row = _get_visible_order_or_404(db, org_id, order_id, current_user, level)
    if level == "own" and row.status not in REVIEW_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="После одобрения заявку может удалить только приёмщик",
        )
    delete_repair_order(db, org_id=org_id, order_id=order_id)
    db.commit()


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
    org_id = _require_full_orders(db, current_user)
    row = _get_org_order_or_404(db, org_id, order_id)
    if row.status in REVIEW_STATUSES and payload.status != "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сначала примите заявку на проверке",
        )
    if payload.status not in ALL_STATUSES or payload.status in REVIEW_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недопустимый статус",
        )
    prev_status = row.status
    if payload.status == "completed" and prev_status != "completed":
        ensure_order_fully_paid(db, row, _order_grand_total(row))
    if payload.status == "cancelled" and prev_status not in ("cancelled", "completed"):
        release_order_reservations(db, row)
    if prev_status != payload.status:
        record_repair_order_status_timestamp(row, payload.status)
    row.status = payload.status
    if prev_status == "completed" and payload.status != "completed":
        clear_order_accruals(db, row.id)
    if payload.status == "completed" and prev_status != "completed":
        db.flush()
        accrue_order_payroll(db, row)
        fulfill_autoservice_stock_on_order_complete(
            db,
            order=row,
            org_id=org_id,
            user_id=current_user.id,
        )
    db.commit()
    row = _get_org_order_or_404(db, org_id, order_id)
    return _to_staff_view(db, row)


@router.post(
    "/autoservice/repair-orders/{order_id}/payments",
    response_model=RepairOrderStaffView,
)
def post_repair_order_payment(
    order_id: int,
    payload: AutoservicePaymentIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = _require_full_orders(db, current_user)
    row = _get_org_order_or_404(db, org_id, order_id)
    grand_total = _order_grand_total(row)
    create_repair_order_payment(
        db,
        order=row,
        org_id=org_id,
        user_id=current_user.id,
        method=payload.method,
        amount=payload.amount,
        grand_total=grand_total,
        paid_at=payload.paid_at,
    )
    db.commit()
    row = _get_org_order_or_404(db, org_id, order_id)
    return _to_staff_view(db, row)
