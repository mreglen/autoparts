"""Публичные метрики доверия к организации-продавцу (этап 11)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.chat import Chat, Message
from app.models.garage_new_orders import GarageNewOrder
from app.models.garage_used_orders import GarageUsedOrder
from app.models.organization import Organization
from app.models.product import Product
from app.models.stock_out import StockOut
from app.models.user import User
from app.services.stock_out_sales import is_warehouse_sale

USED_COMPLETED_STATUSES = frozenset({"delivered", "closed"})
NEW_COMPLETED_STATUS = "new_received"
RESPONSE_SAMPLE_DAYS = 90
MAX_RESPONSE_SAMPLES = 200


@dataclass(frozen=True)
class OrganizationTrustStats:
    organization_id: str
    completed_sales_count: int
    catalog_products_count: int
    avg_response_minutes: int | None
    is_verified_seller: bool
    profile_complete: bool
    has_moderated_products: bool


def _org_profile_complete(org: Organization | None) -> bool:
    if not org:
        return False
    phone_ok = bool(org.phone and str(org.phone).strip())
    description_ok = bool(org.description and str(org.description).strip())
    return phone_ok and description_ok


def _count_catalog_products(db: Session, organization_id: str) -> int:
    return int(
        db.query(func.count(Product.id))
        .filter(
            Product.organization_id == organization_id,
            func.coalesce(Product.quantity, 0) > 0,
        )
        .scalar()
        or 0
    )


def _count_completed_used_orders(db: Session, organization_id: str) -> int:
    return int(
        db.query(func.count(GarageUsedOrder.id))
        .filter(
            GarageUsedOrder.organization_id == organization_id,
            GarageUsedOrder.status_code.in_(tuple(USED_COMPLETED_STATUSES)),
        )
        .scalar()
        or 0
    )


def _count_completed_new_orders(db: Session, organization_id: str) -> int:
    return int(
        db.query(func.count(GarageNewOrder.id))
        .filter(
            GarageNewOrder.organization_id == organization_id,
            GarageNewOrder.status_code == NEW_COMPLETED_STATUS,
        )
        .scalar()
        or 0
    )


def _count_standalone_warehouse_sales(db: Session, organization_id: str) -> int:
    rows = (
        db.query(StockOut)
        .filter(
            StockOut.organization_id == organization_id,
            StockOut.garage_used_order_item_id.is_(None),
            or_(
                StockOut.sale_price > 0,
                StockOut.sale_channel == "avito",
                StockOut.source_kind == "avito",
                StockOut.avito_order_id.isnot(None),
                func.coalesce(func.lower(StockOut.reason), "").like("%авито%"),
                StockOut.sale_channel == "marketplace_used",
                StockOut.source_kind == "marketplace_used",
            ),
        )
        .all()
    )
    return sum(1 for row in rows if is_warehouse_sale(row))


def _seller_user_ids(db: Session, organization_id: str) -> set[int]:
    rows = (
        db.query(User.id)
        .filter(User.organization_id == organization_id, User.is_seller.is_(True))
        .all()
    )
    return {int(row[0]) for row in rows if row[0] is not None}


def _average_response_minutes(db: Session, organization_id: str) -> int | None:
    seller_ids = _seller_user_ids(db, organization_id)
    if not seller_ids:
        return None

    since = datetime.now(timezone.utc) - timedelta(days=RESPONSE_SAMPLE_DAYS)
    chats = (
        db.query(Chat.id)
        .filter(
            Chat.organization_id == organization_id,
            Chat.is_active.is_(True),
        )
        .limit(500)
        .all()
    )
    chat_ids = [int(row[0]) for row in chats if row[0] is not None]
    if not chat_ids:
        return None

    messages = (
        db.query(Message.chat_id, Message.sender_id, Message.created_at)
        .filter(
            Message.chat_id.in_(chat_ids),
            Message.created_at >= since,
        )
        .order_by(Message.chat_id.asc(), Message.created_at.asc())
        .limit(MAX_RESPONSE_SAMPLES * 20)
        .all()
    )

    deltas: list[float] = []
    pending_buyer_at: dict[int, datetime] = {}

    for chat_id, sender_id, created_at in messages:
        if created_at is None:
            continue
        ts = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
        sender = int(sender_id or 0)
        if sender in seller_ids:
            buyer_ts = pending_buyer_at.pop(chat_id, None)
            if buyer_ts is not None:
                delta_min = (ts - buyer_ts).total_seconds() / 60.0
                if 0 < delta_min <= 60 * 24 * 7:
                    deltas.append(delta_min)
                    if len(deltas) >= MAX_RESPONSE_SAMPLES:
                        break
        else:
            pending_buyer_at[chat_id] = ts

    if not deltas:
        return None
    return int(round(sum(deltas) / len(deltas)))


def get_organization_trust_stats(db: Session, organization_id: str) -> OrganizationTrustStats | None:
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org:
        return None

    catalog_products_count = _count_catalog_products(db, organization_id)
    completed_sales_count = (
        _count_completed_used_orders(db, organization_id)
        + _count_completed_new_orders(db, organization_id)
        + _count_standalone_warehouse_sales(db, organization_id)
    )
    profile_complete = _org_profile_complete(org)
    has_moderated_products = catalog_products_count > 0
    is_verified_seller = (
        profile_complete
        and has_moderated_products
        and completed_sales_count >= 1
    )

    return OrganizationTrustStats(
        organization_id=organization_id,
        completed_sales_count=completed_sales_count,
        catalog_products_count=catalog_products_count,
        avg_response_minutes=_average_response_minutes(db, organization_id),
        is_verified_seller=is_verified_seller,
        profile_complete=profile_complete,
        has_moderated_products=has_moderated_products,
    )
