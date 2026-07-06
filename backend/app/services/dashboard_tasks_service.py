"""Сводка задач продавца для дашборда (лёгкие COUNT-запросы)."""
from __future__ import annotations

import json

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.chat import Chat, Message
from app.models.garage_new_orders import GarageNewOrder
from app.models.garage_used_orders import GarageUsedOrder
from app.models.organization_avito_autoload_cache import OrganizationAvitoAutoloadCache
from app.models.pending_product import PendingProduct
from app.models.permission import Permission
from app.models.product import Product, ProductPhoto
from app.models.user import User
from app.models.user_permission import UserPermission
from app.schemas.dashboard import DashboardTaskItem, DashboardTasksResponse
from app.utils.chat_access import get_user_chats_query


def _has_permission(db: Session, user: User, code: str) -> bool:
    if user.is_admin or user.is_seller:
        return True
    if not user.is_employee:
        return False
    q = (
        db.query(Permission.code)
        .join(UserPermission, UserPermission.permission_id == Permission.id)
        .filter(UserPermission.user_id == user.id, Permission.code == code)
    )
    return db.query(q.exists()).scalar() is True


def _has_sales_orders_access(db: Session, user: User) -> bool:
    return _has_permission(db, user, "sales.orders")


def _has_my_parts_access(db: Session, user: User) -> bool:
    return _has_permission(db, user, "my-parts")


def _has_avito_integration_access(db: Session, user: User) -> bool:
    if user.is_admin or user.is_seller or user.is_director:
        return True
    return _has_permission(db, user, "settings.integration.avito")


def _count_unread_messages(db: Session, user_id: int) -> int:
    accessible_chat_ids = [
        row[0]
        for row in get_user_chats_query(db, user_id).with_entities(Chat.id).all()
    ]
    if not accessible_chat_ids:
        return 0
    return (
        db.query(func.count(Message.id))
        .filter(
            Message.chat_id.in_(accessible_chat_ids),
            Message.sender_id != user_id,
            Message.is_read.is_(False),
        )
        .scalar()
        or 0
    )


def _count_avito_errors(db: Session, organization_id: str) -> int:
    cache = (
        db.query(OrganizationAvitoAutoloadCache)
        .filter(OrganizationAvitoAutoloadCache.organization_id == organization_id)
        .first()
    )
    if not cache:
        return 0
    total = 0
    if cache.avito_token_error:
        total += 1
    if cache.local_validation_ok is False:
        total += 1
    try:
        local_errors = json.loads(cache.local_errors_json or "[]")
        if isinstance(local_errors, list):
            total += len(local_errors)
    except (TypeError, ValueError, json.JSONDecodeError):
        pass
    return total


def _append_task(
    tasks: list[DashboardTaskItem],
    *,
    task_id: str,
    title: str,
    count: int,
    severity: str,
    url: str,
    hint: str | None = None,
) -> None:
    if count <= 0:
        return
    tasks.append(
        DashboardTaskItem(
            id=task_id,
            title=title,
            count=count,
            severity=severity,
            url=url,
            hint=hint,
        )
    )


def get_dashboard_tasks(db: Session, user: User) -> DashboardTasksResponse:
    tasks: list[DashboardTaskItem] = []
    org_id = user.organization_id

    if org_id and _has_sales_orders_access(db, user):
        used_pending = (
            db.query(func.count(GarageUsedOrder.id))
            .filter(
                GarageUsedOrder.organization_id == org_id,
                GarageUsedOrder.status_code == "pending",
            )
            .scalar()
            or 0
        )
        new_pending = (
            db.query(func.count(GarageNewOrder.id))
            .filter(
                GarageNewOrder.organization_id == org_id,
                GarageNewOrder.status_code == "new_waiting_confirmation",
            )
            .scalar()
            or 0
        )
        pending_orders = int(used_pending) + int(new_pending)
        _append_task(
            tasks,
            task_id="new_orders",
            title="Новые заказы",
            count=pending_orders,
            severity="high",
            url="/sales/orders",
            hint="Ожидают подтверждения",
        )

    unread = _count_unread_messages(db, user.id)
    _append_task(
        tasks,
        task_id="unread_messages",
        title="Новые сообщения",
        count=unread,
        severity="high" if unread >= 5 else "medium",
        url="/chats",
        hint="Непрочитанные в чатах",
    )

    if org_id and _has_avito_integration_access(db, user):
        avito_errors = _count_avito_errors(db, org_id)
        _append_task(
            tasks,
            task_id="avito_errors",
            title="Ошибки Avito",
            count=avito_errors,
            severity="high",
            url="/settings/integration/avito",
            hint="Проблемы выгрузки или токена",
        )

    if org_id and _has_my_parts_access(db, user):
        no_photo_count = (
            db.query(func.count(Product.id))
            .outerjoin(ProductPhoto, ProductPhoto.product_id == Product.id)
            .filter(
                Product.organization_id == org_id,
                ProductPhoto.id.is_(None),
            )
            .scalar()
            or 0
        )
        _append_task(
            tasks,
            task_id="products_no_photo",
            title="Товары без фото",
            count=int(no_photo_count),
            severity="medium",
            url="/my-parts?no_photo=1",
            hint="Добавьте фото для каталога",
        )

        on_moderation = (
            db.query(func.count(PendingProduct.id))
            .filter(PendingProduct.organization_id == org_id)
            .scalar()
            or 0
        )
        _append_task(
            tasks,
            task_id="on_moderation",
            title="На модерации",
            count=int(on_moderation),
            severity="medium",
            url="/my-parts?tab=pending",
            hint="Ожидают проверки администратором",
        )

        zero_stock = (
            db.query(func.count(Product.id))
            .filter(
                Product.organization_id == org_id,
                func.coalesce(Product.quantity, 0) <= 0,
            )
            .scalar()
            or 0
        )
        _append_task(
            tasks,
            task_id="zero_stock",
            title="Закончился остаток",
            count=int(zero_stock),
            severity="high",
            url="/my-parts?stock=zero",
            hint="Пополните или спишите позиции",
        )

        low_stock = (
            db.query(func.count(Product.id))
            .filter(
                Product.organization_id == org_id,
                Product.quantity > 0,
                Product.quantity <= 2,
            )
            .scalar()
            or 0
        )
        _append_task(
            tasks,
            task_id="low_stock",
            title="Низкий остаток",
            count=int(low_stock),
            severity="medium",
            url="/my-parts?stock=low",
            hint="1–2 шт. на складе",
        )

        from app.models.product_avito_listing_link import ProductAvitoListingLink

        listed_product_ids = (
            db.query(ProductAvitoListingLink.product_id)
            .filter(ProductAvitoListingLink.organization_id == org_id)
            .distinct()
        )
        not_on_avito_count = (
            db.query(func.count(Product.id))
            .filter(
                Product.organization_id == org_id,
                Product.quantity > 0,
                ~Product.id.in_(listed_product_ids),
            )
            .scalar()
            or 0
        )
        if _has_avito_integration_access(db, user):
            _append_task(
                tasks,
                task_id="not_on_avito",
                title="Не на Avito",
                count=int(not_on_avito_count),
                severity="low",
                url="/my-parts",
                hint="Товары в наличии без объявления",
            )

    severity_order = {"high": 0, "medium": 1, "low": 2}
    tasks.sort(key=lambda t: (severity_order.get(t.severity, 9), -t.count, t.title))

    return DashboardTasksResponse(tasks=tasks)
