from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time
from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.autoservice_client import AutoserviceClient
from app.models.autoservice_payroll_accrual import AutoservicePayrollAccrual
from app.models.autoservice_service_employee import AutoserviceServiceEmployee
from app.models.garage_vehicle import GarageVehicle
from app.models.repair_order import (
    RepairOrder,
    RepairOrderShopPart,
    RepairOrderWork,
    RepairOrderWorkExecutor,
)
from app.schemas.repair_order import ALL_STATUSES, LEGACY_STATUS_MAP
from app.services.autoservice_payment_service import batch_paid_amounts
from app.utils.autoservice_access import display_client_phone

_TWOPLACES = Decimal("0.01")
_THREEPLACES = Decimal("0.001")
_COMPLETED_STATUSES = {"completed", "ready", "issued"}


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
    floor_rubles: bool = False,
) -> Decimal:
    price = _money(unit_price)
    markup = Decimal(str(markup_percent))
    result = price * (Decimal("1") + markup / Decimal("100"))
    if floor_rubles:
        return result.quantize(Decimal("1"), rounding=ROUND_DOWN).quantize(_TWOPLACES)
    return _money(result)


def _effective_shop_unit_price(part: RepairOrderShopPart) -> Decimal:
    override = getattr(part, "client_unit_price_override", None)
    if override is not None:
        return _money(override)
    return _price_with_markup(
        part.unit_price,
        part.markup_percent,
        floor_rubles=part.source == "rossko",
    )


def _shop_line_sum(
    qty: Decimal | int | float | str,
    client_unit_price: Decimal | int | float | str,
) -> Decimal:
    return _money(_qty(qty) * _money(client_unit_price))


def _normalize_status(status: str) -> str:
    return LEGACY_STATUS_MAP.get(status, status)


def _is_completed(status: str) -> bool:
    return _normalize_status(status) == "completed"


def _status_label(status: str) -> str:
    labels = {
        "pending": "Ожидание",
        "in_progress": "В работе",
        "done": "Выполнен",
        "completed": "Закрыт",
        "cancelled": "Отменён",
    }
    return labels.get(_normalize_status(status), status)


def _payment_status(paid_amount: Decimal, remaining_amount: Decimal) -> str:
    if remaining_amount <= Decimal("0.00"):
        return "paid"
    if paid_amount > Decimal("0.00"):
        return "partial"
    return "unpaid"


def _payment_status_label(payment_status: str) -> str:
    return {
        "paid": "Оплачено",
        "partial": "Частично",
        "unpaid": "Долг",
    }.get(payment_status, payment_status)


@dataclass
class OrderEconomicsFilters:
    date_from: date
    date_to: date
    status: str = "all"
    payment: str = "all"
    q: str | None = None


def _period_bounds(date_from: date, date_to: date) -> tuple[datetime, datetime]:
    start = datetime.combine(date_from, time.min)
    end = datetime.combine(date_to, time.max)
    if end < start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректный период",
        )
    return start, end


def _order_economics_query(db: Session):
    return db.query(RepairOrder).options(
        joinedload(RepairOrder.client),
        joinedload(RepairOrder.vehicle),
        selectinload(RepairOrder.works)
        .selectinload(RepairOrderWork.executors)
        .joinedload(RepairOrderWorkExecutor.employee),
        selectinload(RepairOrder.shop_parts),
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


def _sorted_works(order: RepairOrder) -> list[RepairOrderWork]:
    return sorted(order.works or [], key=lambda work: (work.position, work.id))


def _sorted_shop_parts(order: RepairOrder) -> list[RepairOrderShopPart]:
    return sorted(order.shop_parts or [], key=lambda part: (part.position, part.id))


def _order_grand_total(order: RepairOrder) -> Decimal:
    works_total = _money(
        sum(
            (_line_sum(work.qty, work.unit_price) for work in _sorted_works(order)),
            Decimal("0.00"),
        )
    )
    shop_total = _money(
        sum(
            (
                _shop_line_sum(part.qty, _effective_shop_unit_price(part))
                for part in _sorted_shop_parts(order)
            ),
            Decimal("0.00"),
        )
    )
    return _money(works_total + shop_total)


def _order_parts_cost(order: RepairOrder) -> Decimal:
    return _money(
        sum(
            (_shop_line_sum(part.qty, part.unit_price) for part in _sorted_shop_parts(order)),
            Decimal("0.00"),
        )
    )


def _preview_order_payroll(
    order: RepairOrder,
    employees_by_id: dict[int, AutoserviceServiceEmployee],
) -> Decimal:
    daily_employees: set[int] = set()
    total = Decimal("0.00")
    for work in _sorted_works(order):
        line_total = _line_sum(work.qty, work.unit_price)
        for row in work.executors or []:
            amount = _money(line_total * _money(row.percent) / Decimal("100"))
            if amount <= 0:
                continue
            total += amount
            daily_employees.add(row.employee_id)
    for employee_id in daily_employees:
        employee = employees_by_id.get(employee_id)
        if employee is None or employee.salary_type != "daily_rate":
            continue
        rate = _money(employee.salary_amount)
        if rate > 0:
            total += rate
    return _money(total)


def _batch_payroll_totals(db: Session, order_ids: list[int]) -> dict[int, Decimal]:
    if not order_ids:
        return {}
    rows = (
        db.query(
            AutoservicePayrollAccrual.order_id,
            func.coalesce(func.sum(AutoservicePayrollAccrual.amount), 0),
        )
        .filter(AutoservicePayrollAccrual.order_id.in_(order_ids))
        .group_by(AutoservicePayrollAccrual.order_id)
        .all()
    )
    return {order_id: _money(amount) for order_id, amount in rows}


def _vehicle_brief(vehicle: GarageVehicle | None) -> dict | None:
    if vehicle is None:
        return None
    return {
        "id": vehicle.id,
        "make": vehicle.make,
        "model": vehicle.model,
        "year": vehicle.year,
        "plate": vehicle.plate,
    }


def _build_order_row(
    order: RepairOrder,
    *,
    paid_amount: Decimal,
    payroll_total: Decimal,
    is_preliminary: bool,
) -> dict:
    grand_total = _order_grand_total(order)
    parts_cost = _order_parts_cost(order)
    payroll = _money(payroll_total)
    net_profit = _money(grand_total - parts_cost - payroll)
    paid = _money(paid_amount)
    remaining = _money(max(Decimal("0.00"), grand_total - paid))
    payment_status = _payment_status(paid, remaining)
    client = order.client
    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "status": _normalize_status(order.status),
        "client_name": client.name if client else "—",
        "client_phone": display_client_phone(client.phone) if client else "",
        "vehicle": _vehicle_brief(order.vehicle),
        "scheduled_at": order.scheduled_at,
        "grand_total": grand_total,
        "parts_cost": parts_cost,
        "payroll_total": payroll,
        "net_profit": net_profit,
        "paid_amount": paid,
        "remaining_amount": remaining,
        "is_paid": remaining <= Decimal("0.00"),
        "payment_status": payment_status,
        "is_preliminary": is_preliminary,
        "works_count": len(order.works or []),
        "shop_parts_count": len(order.shop_parts or []),
    }


def _matches_payment_filter(row: dict, payment: str) -> bool:
    if payment == "all":
        return True
    return row["payment_status"] == payment


def _matches_status_filter(status_value: str, status_filter: str) -> bool:
    if status_filter == "all":
        return True
    normalized = _normalize_status(status_value)
    if status_filter in ALL_STATUSES:
        return normalized == status_filter
    return normalized == _normalize_status(status_filter)


def build_order_economics_report(
    db: Session,
    org_id: str,
    filters: OrderEconomicsFilters,
) -> dict:
    start, end = _period_bounds(filters.date_from, filters.date_to)
    query = (
        _order_economics_query(db)
        .filter(
            RepairOrder.organization_id == org_id,
            RepairOrder.scheduled_at >= start,
            RepairOrder.scheduled_at <= end,
        )
    )
    query = _apply_search_filter(query, filters.q)
    orders = query.order_by(RepairOrder.scheduled_at.desc(), RepairOrder.id.desc()).all()

    order_ids = [order.id for order in orders]
    paid_map = batch_paid_amounts(db, order_ids)
    completed_ids = [order.id for order in orders if _is_completed(order.status)]
    payroll_map = _batch_payroll_totals(db, completed_ids)

    preview_employee_ids: set[int] = set()
    for order in orders:
        if _is_completed(order.status):
            continue
        for work in _sorted_works(order):
            for row in work.executors or []:
                preview_employee_ids.add(row.employee_id)
    employees_by_id: dict[int, AutoserviceServiceEmployee] = {}
    if preview_employee_ids:
        employees = (
            db.query(AutoserviceServiceEmployee)
            .filter(
                AutoserviceServiceEmployee.organization_id == org_id,
                AutoserviceServiceEmployee.id.in_(preview_employee_ids),
            )
            .all()
        )
        employees_by_id = {employee.id: employee for employee in employees}

    items: list[dict] = []
    summary = {
        "count": 0,
        "revenue": Decimal("0.00"),
        "parts_cost": Decimal("0.00"),
        "payroll_total": Decimal("0.00"),
        "net_profit": Decimal("0.00"),
        "paid_amount": Decimal("0.00"),
        "debt_amount": Decimal("0.00"),
        "unpaid_count": 0,
    }

    for order in orders:
        is_preliminary = not _is_completed(order.status)
        if is_preliminary:
            payroll_total = _preview_order_payroll(order, employees_by_id)
        else:
            payroll_total = payroll_map.get(order.id, Decimal("0.00"))
        row = _build_order_row(
            order,
            paid_amount=paid_map.get(order.id, Decimal("0.00")),
            payroll_total=payroll_total,
            is_preliminary=is_preliminary,
        )
        if not _matches_payment_filter(row, filters.payment):
            continue
        if not _matches_status_filter(order.status, filters.status):
            continue
        items.append(row)
        summary["count"] += 1
        summary["revenue"] += row["grand_total"]
        summary["parts_cost"] += row["parts_cost"]
        summary["payroll_total"] += row["payroll_total"]
        summary["net_profit"] += row["net_profit"]
        summary["paid_amount"] += row["paid_amount"]
        summary["debt_amount"] += row["remaining_amount"]
        if row["remaining_amount"] > Decimal("0.00"):
            summary["unpaid_count"] += 1

    for key in ("revenue", "parts_cost", "payroll_total", "net_profit", "paid_amount", "debt_amount"):
        summary[key] = _money(summary[key])

    return {
        "date_from": filters.date_from,
        "date_to": filters.date_to,
        "summary": summary,
        "items": items,
    }


def order_economics_status_label(status: str) -> str:
    return _status_label(status)


def order_economics_payment_label(payment_status: str) -> str:
    return _payment_status_label(payment_status)
