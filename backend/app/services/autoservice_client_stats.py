from __future__ import annotations

from decimal import ROUND_CEILING, ROUND_HALF_UP, Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.autoservice_payment import AutoservicePayment
from app.models.repair_order import RepairOrder, RepairOrderShopPart, RepairOrderWork

_MONEY = Decimal("0.01")


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(_MONEY, rounding=ROUND_HALF_UP)


def _part_client_price(unit_price, markup_percent, override) -> Decimal:
    if override is not None:
        return _money(override)
    base = _money(unit_price) * (Decimal("1") + Decimal(str(markup_percent or 0)) / Decimal("100"))
    return base.quantize(Decimal("1"), rounding=ROUND_CEILING).quantize(_MONEY)


def client_stats_map(
    db: Session,
    org_id: str,
    client_ids: list[int],
) -> dict[int, dict]:
    stats = {
        cid: {
            "orders_count": 0,
            "orders_total": Decimal("0"),
            "paid_total": Decimal("0"),
            "last_visit_at": None,
        }
        for cid in client_ids
    }
    if not client_ids:
        return stats

    orders = (
        db.query(
            RepairOrder.id,
            RepairOrder.client_id,
            RepairOrder.discount_percent,
            RepairOrder.created_at,
        )
        .filter(
            RepairOrder.organization_id == org_id,
            RepairOrder.client_id.in_(client_ids),
            RepairOrder.status != "cancelled",
        )
        .all()
    )
    order_by_id: dict[int, tuple[int, Decimal]] = {}
    for order_id, client_id, discount, created_at in orders:
        if client_id not in stats:
            continue
        order_by_id[order_id] = (client_id, Decimal(str(discount or 0)))
        bucket = stats[client_id]
        bucket["orders_count"] += 1
        if created_at and (bucket["last_visit_at"] is None or created_at > bucket["last_visit_at"]):
            bucket["last_visit_at"] = created_at

    order_ids = list(order_by_id)
    if order_ids:
        per_order: dict[int, Decimal] = {}
        for order_id, qty, unit_price in (
            db.query(RepairOrderWork.order_id, RepairOrderWork.qty, RepairOrderWork.unit_price)
            .filter(RepairOrderWork.order_id.in_(order_ids))
            .all()
        ):
            per_order[order_id] = per_order.get(order_id, Decimal("0")) + _money(
                Decimal(int(qty or 0)) * _money(unit_price)
            )
        for order_id, qty, unit_price, markup, override in (
            db.query(
                RepairOrderShopPart.order_id,
                RepairOrderShopPart.qty,
                RepairOrderShopPart.unit_price,
                RepairOrderShopPart.markup_percent,
                RepairOrderShopPart.client_unit_price_override,
            )
            .filter(RepairOrderShopPart.order_id.in_(order_ids))
            .all()
        ):
            price = _part_client_price(unit_price, markup, override)
            per_order[order_id] = per_order.get(order_id, Decimal("0")) + _money(
                Decimal(str(qty or 0)) * price
            )
        for order_id, (client_id, discount) in order_by_id.items():
            pct = min(discount, Decimal("100"))
            factor = Decimal("1") - pct / Decimal("100")
            stats[client_id]["orders_total"] += _money(per_order.get(order_id, Decimal("0")) * factor)

        for client_id, amount in (
            db.query(
                RepairOrder.client_id,
                func.coalesce(func.sum(AutoservicePayment.amount), 0),
            )
            .join(AutoservicePayment, AutoservicePayment.repair_order_id == RepairOrder.id)
            .filter(
                RepairOrder.organization_id == org_id,
                RepairOrder.client_id.in_(client_ids),
                AutoservicePayment.cancelled_at.is_(None),
            )
            .group_by(RepairOrder.client_id)
            .all()
        ):
            if client_id in stats:
                stats[client_id]["paid_total"] = _money(amount)

    for bucket in stats.values():
        bucket["debt_amount"] = _money(
            max(Decimal("0"), bucket["orders_total"] - bucket["paid_total"])
        )
    return stats
