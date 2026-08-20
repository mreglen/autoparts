from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.models.autoservice_payroll_accrual import AutoservicePayrollAccrual
from app.models.autoservice_service_employee import AutoserviceServiceEmployee
from app.models.garage_vehicle import GarageVehicle
from app.models.repair_order import RepairOrder, RepairOrderWork


def _money(value: Decimal | float | int) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _line_sum(qty: int, unit_price: Decimal) -> Decimal:
    return _money(Decimal(qty) * unit_price)


def _period_bounds(period: str, ref: date | None = None) -> tuple[datetime, datetime]:
    today = ref or date.today()
    if period == "day":
        start = datetime.combine(today, datetime.min.time())
        end = start + timedelta(days=1)
    elif period == "week":
        start_date = today - timedelta(days=today.weekday())
        start = datetime.combine(start_date, datetime.min.time())
        end = start + timedelta(days=7)
    elif period == "year":
        start = datetime(today.year, 1, 1)
        end = datetime(today.year + 1, 1, 1)
    else:
        start = datetime(today.year, today.month, 1)
        if today.month == 12:
            end = datetime(today.year + 1, 1, 1)
        else:
            end = datetime(today.year, today.month + 1, 1)
    return start, end


def clear_order_accruals(db: Session, order_id: int) -> None:
    db.query(AutoservicePayrollAccrual).filter(
        AutoservicePayrollAccrual.order_id == order_id,
    ).delete(synchronize_session=False)


def accrue_order_payroll(db: Session, order: RepairOrder) -> None:
    clear_order_accruals(db, order.id)
    works = sorted(order.works or [], key=lambda w: (w.position, w.id))
    daily_employees: set[int] = set()

    for work in works:
        line_total = _line_sum(work.qty, _money(work.unit_price))
        for row in work.executors or []:
            amount = _money(line_total * _money(row.percent) / Decimal("100"))
            if amount <= 0:
                continue
            db.add(
                AutoservicePayrollAccrual(
                    organization_id=order.organization_id,
                    employee_id=row.employee_id,
                    order_id=order.id,
                    work_id=work.id,
                    accrual_type="work_percent",
                    amount=amount,
                )
            )
            daily_employees.add(row.employee_id)

    if not daily_employees:
        return

    employees = (
        db.query(AutoserviceServiceEmployee)
        .filter(AutoserviceServiceEmployee.id.in_(daily_employees))
        .all()
    )
    for employee in employees:
        if employee.salary_type != "daily_rate":
            continue
        rate = _money(employee.salary_amount)
        if rate <= 0:
            continue
        db.add(
            AutoservicePayrollAccrual(
                organization_id=order.organization_id,
                employee_id=employee.id,
                order_id=order.id,
                work_id=None,
                accrual_type="daily_rate",
                amount=rate,
            )
        )


def compute_employee_stats(
    db: Session,
    org_id: str,
    employee: AutoserviceServiceEmployee,
    period: str,
) -> dict:
    start, end = _period_bounds(period)
    accruals = (
        db.query(AutoservicePayrollAccrual)
        .filter(
            AutoservicePayrollAccrual.organization_id == org_id,
            AutoservicePayrollAccrual.employee_id == employee.id,
            AutoservicePayrollAccrual.accrued_at >= start,
            AutoservicePayrollAccrual.accrued_at < end,
        )
        .all()
    )
    from_works = sum(
        (_money(a.amount) for a in accruals if a.accrual_type == "work_percent"),
        Decimal("0.00"),
    )
    from_daily = sum(
        (_money(a.amount) for a in accruals if a.accrual_type == "daily_rate"),
        Decimal("0.00"),
    )
    order_ids = {a.order_id for a in accruals}
    from_fixed = Decimal("0.00")
    if employee.salary_type == "fixed" and employee.is_active:
        fixed = _money(employee.salary_amount)
        if fixed > 0:
            days_in_period = (end.date() - start.date()).days or 1
            if period == "month":
                days_in_period = monthrange(start.year, start.month)[1]
            elif period == "year":
                days_in_period = 366 if start.year % 4 == 0 else 365
            daily_part = _money(fixed / Decimal(days_in_period))
            from_fixed = _money(daily_part * Decimal(days_in_period if period != "day" else 1))

    total = _money(from_works + from_daily + from_fixed)
    return {
        "period": period,
        "total": total,
        "from_works": _money(from_works),
        "from_daily": _money(from_daily),
        "from_fixed": _money(from_fixed),
        "completed_orders": len(order_ids),
    }


def month_bounds(year: int, month: int) -> tuple[datetime, datetime]:
    start = datetime(year, month, 1)
    if month == 12:
        return start, datetime(year + 1, 1, 1)
    return start, datetime(year, month + 1, 1)


def _vehicle_brief(vehicle) -> dict | None:
    if vehicle is None:
        return None
    return {
        "id": vehicle.id,
        "make": vehicle.make,
        "model": vehicle.model,
        "year": vehicle.year,
        "vin": vehicle.vin,
        "plate": vehicle.plate,
    }


def compute_org_monthly_payroll(db: Session, org_id: str, year: int, month: int) -> dict:
    start, end = month_bounds(year, month)
    employees = (
        db.query(AutoserviceServiceEmployee)
        .filter(AutoserviceServiceEmployee.organization_id == org_id)
        .order_by(AutoserviceServiceEmployee.name.asc())
        .all()
    )
    accruals = (
        db.query(AutoservicePayrollAccrual)
        .filter(
            AutoservicePayrollAccrual.organization_id == org_id,
            AutoservicePayrollAccrual.accrued_at >= start,
            AutoservicePayrollAccrual.accrued_at < end,
        )
        .all()
    )

    by_emp: dict[int, dict] = {}
    for emp in employees:
        if not emp.is_active:
            continue
        by_emp[emp.id] = {
            "employee_id": emp.id,
            "name": emp.name,
            "order_amounts": {},
        }

    employees_by_id = {emp.id: emp for emp in employees}
    all_order_ids: set[int] = set()
    for accrual in accruals:
        bucket = by_emp.get(accrual.employee_id)
        if bucket is None:
            emp = employees_by_id.get(accrual.employee_id)
            bucket = {
                "employee_id": accrual.employee_id,
                "name": emp.name if emp else f"#{accrual.employee_id}",
                "order_amounts": {},
            }
            by_emp[accrual.employee_id] = bucket
        if not accrual.order_id:
            continue
        all_order_ids.add(accrual.order_id)
        amount = _money(accrual.amount)
        bucket["order_amounts"][accrual.order_id] = (
            bucket["order_amounts"].get(accrual.order_id, Decimal("0.00")) + amount
        )

    orders_by_id: dict[int, RepairOrder] = {}
    vehicles_by_id: dict[int, GarageVehicle] = {}
    if all_order_ids:
        orders = (
            db.query(RepairOrder)
            .filter(RepairOrder.id.in_(all_order_ids))
            .all()
        )
        orders_by_id = {order.id: order for order in orders}
        vehicle_ids = {order.vehicle_id for order in orders if order.vehicle_id}
        if vehicle_ids:
            vehicles = (
                db.query(GarageVehicle)
                .filter(GarageVehicle.id.in_(vehicle_ids))
                .all()
            )
            vehicles_by_id = {vehicle.id: vehicle for vehicle in vehicles}

    rows = []
    total = Decimal("0.00")
    for bucket in sorted(by_emp.values(), key=lambda item: item["name"].lower()):
        order_rows = []
        row_total = Decimal("0.00")
        for order_id, amount in sorted(
            bucket["order_amounts"].items(),
            key=lambda item: (
                orders_by_id[item[0]].order_number if item[0] in orders_by_id else str(item[0])
            ),
        ):
            order = orders_by_id.get(order_id)
            order_amount = _money(amount)
            row_total += order_amount
            vehicle = vehicles_by_id.get(order.vehicle_id) if order and order.vehicle_id else None
            order_rows.append(
                {
                    "order_id": order_id,
                    "order_number": order.order_number if order else f"#{order_id}",
                    "vehicle": _vehicle_brief(vehicle),
                    "amount": order_amount,
                }
            )
        row_total = _money(row_total)
        total += row_total
        rows.append(
            {
                "employee_id": bucket["employee_id"],
                "name": bucket["name"],
                "completed_orders": len(bucket["order_amounts"]),
                "total": row_total,
                "orders": order_rows,
            }
        )
    return {
        "year": year,
        "month": month,
        "total": _money(total),
        "employees": rows,
    }
