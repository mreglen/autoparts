# app/routers/admin.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload, selectinload
from app.models.user import User
from app.models.organization import Organization
from app.models.pending_seller import PendingSeller
from app.models.product import Product
from app.models.stock_out import StockOut
from app.services.stock_out_sales import list_warehouse_sales, warehouse_sales_totals
from app.db.database import get_db
from app.utils.site_settings_db import get_or_create_site_settings
from app.utils.admin_org_access import get_seller_organization
from app.utils.org_markup import (
    apply_global_markup_to_organizations,
    effective_markup_percent,
    global_markup_percent,
)
from app.models.client import Client as ClientModel
from app.models.vehicle import Vehicle as VehicleModel
from app.models.storage_location import StorageLocation as StorageLocationModel
from app.schemas.event_log import EventLogResponse
from app.schemas.user import (
    AdminUserAuditResponse,
    AdminUserDetail,
    AdminUserListItem,
    UserResponse,
    UserSessionBrief,
    UserUpdate,
)
from app.schemas.audit import AuditEventRow
from app.models.user_session import UserSession
from app.services.audit_service import (
    events_to_dicts,
    list_user_audit_events,
)
from app.utils.user_avatar import avatar_public_url
from app.schemas.organization import Organization as OrganizationSchema, OrganizationCreate, OrganizationUpdate
from typing import List, Optional
from pydantic import BaseModel, Field
from app.core.auth import get_current_admin_user, get_current_user
from app.core.security import get_password_hash
from app.utils.id_generator import random_id
from app.services.organization_clients import (
    get_buyer_orders_for_organization,
    list_buyers_for_organization,
)
from app.services.photo_localization import (
    format_failures_for_output,
    migrate_external_product_photos,
)
from app.services.sitemap_service import (
    DEFAULT_PRODUCT_URLS_LIMIT,
    generate_product_urls_text_file,
    get_daily_seo_url_batch,
    get_new_parts_sitemap_cache_meta,
    get_products_sitemap_cache_meta,
    get_site_sitemap_files,
    rebuild_all_sitemaps_cache,
    rebuild_new_parts_sitemap_cache,
    rebuild_products_sitemap_cache,
)
from app.utils.yandex_integration_db import get_or_create_yandex_integration
from app.schemas.client import ClientBuyerOrdersResponse, ClientListItemResponse
from app.utils.event_logger import log_event
from app.utils.user_public_code import assign_public_code
from app.services.audit_service import (
    AuditListFilters,
    list_audit_events,
    log_audit,
    require_audit_access,
)
from app.utils.email import send_verification_email, send_welcome_email
import math
import secrets
import string
from datetime import datetime, timedelta

router = APIRouter(prefix="/admin", tags=["Admin"])


def _new_parts_markup_percent_value(row) -> float:
    v = getattr(row, "new_parts_markup_percent", None)
    return float(v) if v is not None else 15.0


class SiteSettingsResponse(BaseModel):
    show_new_autoparts: bool
    show_site_reviews: bool = True
    new_parts_markup_percent: float
    used_parts_purchase_mode: str = "both"


class SiteSettingsPatch(BaseModel):
    show_new_autoparts: Optional[bool] = None
    show_site_reviews: Optional[bool] = None
    new_parts_markup_percent: Optional[float] = Field(None, ge=0, le=500)
    used_parts_purchase_mode: Optional[str] = None
    global_markup_apply_mode: Optional[str] = Field(
        None,
        description="all — применить глобальную наценку ко всем организациям; skip_manual — пропустить организации с ручной наценкой",
    )


class OrdersV2MigrationResponse(BaseModel):
    used_created: int
    new_created: int
    avito_created: int
    skipped: int


class PhotoLocalizationAdminRequest(BaseModel):
    dry_run: bool = False
    org_id: Optional[str] = None
    all_external: bool = False
    limit: Optional[int] = Field(None, ge=1, le=50000)
    failure_limit: int = Field(30, ge=1, le=200)
    per_photo_timeout_s: float = Field(25.0, ge=1.0, le=120.0)
    celery_timeout_s: int = Field(120, ge=5, le=600)


class PhotoLocalizationFailure(BaseModel):
    photo_id: int
    old_url: str
    reason: str


class PhotoLocalizationAdminResponse(BaseModel):
    dry_run: bool
    scanned: int
    matched: int
    migrated: int
    failed: int
    skipped: int
    failures: List[PhotoLocalizationFailure]


@router.get("/site-settings", response_model=SiteSettingsResponse)
def get_site_settings_admin(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_site_settings(db)
    mode = getattr(row, "used_parts_purchase_mode", None) or "both"
    return SiteSettingsResponse(
        show_new_autoparts=row.show_new_autoparts,
        show_site_reviews=getattr(row, "show_site_reviews", True) is not False,
        new_parts_markup_percent=_new_parts_markup_percent_value(row),
        used_parts_purchase_mode=mode,
    )


@router.patch("/site-settings", response_model=SiteSettingsResponse)
def patch_site_settings_admin(
    payload: SiteSettingsPatch,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    data = payload.dict(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нет полей для обновления",
        )
    row = get_or_create_site_settings(db)
    if "show_new_autoparts" in data:
        row.show_new_autoparts = data["show_new_autoparts"]
    if "show_site_reviews" in data:
        row.show_site_reviews = data["show_site_reviews"]
    apply_mode = data.pop("global_markup_apply_mode", None)
    if "new_parts_markup_percent" in data:
        new_global = float(data["new_parts_markup_percent"])
        row.new_parts_markup_percent = new_global
        if apply_mode in ("all", "skip_manual"):
            apply_global_markup_to_organizations(
                db,
                new_global,
                skip_manual=(apply_mode == "skip_manual"),
            )
    if "used_parts_purchase_mode" in data:
        mode = data["used_parts_purchase_mode"]
        if mode not in ("cart_only", "cta_only", "both"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="used_parts_purchase_mode must be cart_only, cta_only, or both",
            )
        row.used_parts_purchase_mode = mode
    db.commit()
    db.refresh(row)
    log_audit(
        db,
        event_type="site_settings_updated",
        category="settings",
        summary="Настройки сайта обновлены",
        user=current_user,
        details={"updated_fields": list(data.keys())},
    )
    mode = getattr(row, "used_parts_purchase_mode", None) or "both"
    return SiteSettingsResponse(
        show_new_autoparts=row.show_new_autoparts,
        show_site_reviews=getattr(row, "show_site_reviews", True) is not False,
        new_parts_markup_percent=_new_parts_markup_percent_value(row),
        used_parts_purchase_mode=mode,
    )


@router.post("/migrations/orders-v2/up", response_model=OrdersV2MigrationResponse)
def migrate_orders_v2_up(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Миграции заказов отключены (таблицы и ORM-модели заказов удалены)",
    )


@router.post("/migrations/orders-v2/down")
def migrate_orders_v2_down(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Миграции заказов отключены (таблицы и ORM-модели заказов удалены)",
    )


@router.post("/photos/localize-external", response_model=PhotoLocalizationAdminResponse)
def localize_external_product_photos_admin(
    payload: PhotoLocalizationAdminRequest,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    result = migrate_external_product_photos(
        db,
        dry_run=payload.dry_run,
        org_id=payload.org_id,
        process_all_external=payload.all_external,
        row_limit=payload.limit,
        per_photo_timeout_s=payload.per_photo_timeout_s,
        celery_timeout_s=payload.celery_timeout_s,
    )
    counters = result.counters
    failures = format_failures_for_output(result.failures, limit=payload.failure_limit)
    log_audit(
        db,
        event_type="admin_photo_localization_run",
        category="admin",
        summary="Запущена локализация внешних ссылок фото",
        user=current_user,
        details={
            "dry_run": payload.dry_run,
            "org_id": payload.org_id,
            "all_external": payload.all_external,
            "limit": payload.limit,
            "scanned": counters.scanned,
            "matched": counters.matched,
            "migrated": counters.migrated,
            "failed": counters.failed,
            "skipped": counters.skipped,
        },
    )
    return PhotoLocalizationAdminResponse(
        dry_run=payload.dry_run,
        scanned=counters.scanned,
        matched=counters.matched,
        migrated=counters.migrated,
        failed=counters.failed,
        skipped=counters.skipped,
        failures=failures,
    )


def _admin_user_list_item(user: User, db: Session) -> AdminUserListItem:
    org = user.organization
    active_count = (
        db.query(UserSession)
        .filter(UserSession.user_id == user.id, UserSession.is_active.is_(True))
        .count()
    )
    return AdminUserListItem(
        id=user.id,
        public_code=user.public_code,
        last_name=user.last_name,
        first_name=user.first_name,
        patronymic=user.patronymic,
        email=user.email,
        phone=user.phone,
        avatar_url=avatar_public_url(user.avatar_url),
        is_buyer=bool(user.is_buyer),
        is_seller=bool(user.is_seller),
        is_admin=bool(user.is_admin),
        is_director=bool(user.is_director),
        is_employee=bool(user.is_employee),
        organization_id=user.organization_id,
        organization_name=org.name if org else None,
        organization_phone=org.phone if org else None,
        active_sessions_count=active_count,
    )


@router.get("/users", response_model=List[AdminUserListItem])
def get_all_users(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    users = db.query(User).options(joinedload(User.organization)).order_by(User.last_name, User.first_name).all()
    return [_admin_user_list_item(u, db) for u in users]


@router.get("/users/{user_id}", response_model=AdminUserDetail)
def get_admin_user_detail(
    user_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).options(joinedload(User.organization)).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == user_id)
        .order_by(UserSession.last_activity.desc())
        .limit(50)
        .all()
    )
    session_briefs = [
        UserSessionBrief(
            id=s.id,
            device_info=s.device_info,
            ip_address=s.ip_address,
            is_active=bool(s.is_active),
            created_at=s.created_at.isoformat() if s.created_at else None,
            last_activity=s.last_activity.isoformat() if s.last_activity else None,
        )
        for s in sessions
    ]

    log_audit(
        db,
        event_type="admin_user_viewed",
        category="users",
        summary=f"Админ просмотрел пользователя #{user_id}",
        user=current_user,
        organization_id=user.organization_id,
        details={
            "target_user_id": user.id,
            "target_public_code": user.public_code,
            "target_email": user.email,
        },
        entity_type="user",
        entity_id=user.id,
    )

    base = _admin_user_list_item(user, db)
    return AdminUserDetail(**base.model_dump(), sessions=session_briefs)


@router.get("/users/{user_id}/audit", response_model=AdminUserAuditResponse)
def get_admin_user_audit(
    user_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    rows, total = list_user_audit_events(db, user_id, page=page, limit=limit)
    pages = math.ceil(total / limit) if total else 0
    return AdminUserAuditResponse(
        rows=[AuditEventRow(**d) for d in events_to_dicts(db, rows)],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.post("/users/{user_id}/revoke-sessions")
def revoke_user_sessions(
    user_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    active_sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == user_id, UserSession.is_active.is_(True))
        .all()
    )
    count = len(active_sessions)
    for session in active_sessions:
        session.is_active = False
    db.commit()

    log_audit(
        db,
        event_type="admin_user_sessions_revoked",
        category="users",
        summary=f"Админ завершил {count} сессий пользователя #{user_id}",
        user=current_user,
        organization_id=user.organization_id,
        details={
            "target_user_id": user.id,
            "target_public_code": user.public_code,
            "target_email": user.email,
            "sessions_revoked": count,
        },
        entity_type="user",
        entity_id=user.id,
    )

    return {"msg": f"Завершено сессий: {count}", "sessions_revoked": count}


@router.get("/events", response_model=List[EventLogResponse])
def get_event_log(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(200, ge=1, le=500),
):
    """Legacy endpoint; prefer GET /audit/events."""
    require_audit_access(db, current_user)
    rows, _total = list_audit_events(db, AuditListFilters(), page=1, limit=limit)
    return rows

@router.get("/organizations", response_model=List[OrganizationSchema])
def get_all_organizations(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    organizations = db.query(Organization).all()
    return organizations

@router.put("/organizations/{org_id}", response_model=OrganizationSchema)
def update_organization_admin(
    org_id: str,
    org_update: OrganizationUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Организация не найдена")

    # Обновляем поля
    update_data = org_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(org, key, value)

    db.commit()
    db.refresh(org)
    log_audit(
        db,
        event_type="organization_updated",
        category="settings",
        summary=f"Организация обновлена (админ): {org.name or org_id}",
        user=current_user,
        organization_id=org_id,
        details={"organization_id": org_id, "updated_fields": list(update_data.keys())},
        entity_type="organization",
        entity_id=org_id,
    )
    return org


@router.get("/pending-sellers")
def get_pending_sellers(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    pending_sellers = db.query(PendingSeller).all()
    return pending_sellers


@router.get("/sellers")
def get_all_sellers(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    sellers = db.query(User).filter(User.is_seller == True).all()
    settings_row = get_or_create_site_settings(db)
    # Convert to dict format with organization names
    sellers_data = []
    for seller in sellers:
        org = seller.organization
        seller_dict = {
            "id": seller.id,
            "last_name": seller.last_name,
            "first_name": seller.first_name,
            "patronymic": seller.patronymic,
            "email": seller.email,
            "phone": seller.phone,
            "organization_name": org.name if org else None,
            "organization_id": seller.organization_id,
            "is_director": bool(seller.is_director),
            "is_employee": bool(seller.is_employee),
            "is_seller": bool(seller.is_seller),
            "new_parts_markup_percent": effective_markup_percent(org, settings_row),
            "new_parts_markup_manual": bool(getattr(org, "new_parts_markup_manual", False)) if org else False,
            "global_new_parts_markup_percent": global_markup_percent(settings_row),
        }
        sellers_data.append(seller_dict)
    return sellers_data


@router.get("/public/sellers")
def get_public_sellers(
    db: Session = Depends(get_db)
):
    """Public endpoint to get all sellers with their organization information"""
    sellers = db.query(User).filter(User.is_seller == True).all()
    # Convert to dict format with organization names
    sellers_data = []
    for seller in sellers:
        seller_dict = {
            "id": seller.id,
            "last_name": seller.last_name,
            "first_name": seller.first_name,
            "patronymic": seller.patronymic,
            "email": seller.email,
            "phone": seller.phone,
            "organization_name": seller.organization.name if seller.organization else None,
            "organization_id": seller.organization_id,
            "logo_organization": seller.organization.logo_organization if seller.organization else None
        }
        sellers_data.append(seller_dict)
    return sellers_data


class SellerDashboardStats(BaseModel):
    seller_id: str
    seller_name: str
    organization_name: Optional[str]
    activeOrders: int
    totalProducts: int
    totalWarehouseValue: float
    totalWarehouseQuantity: int
    totalSales: float
    newOrders: int
    pendingOrders: int
    completedOrders: int
    warehouseSalesCount: int


@router.get("/sellers/{seller_id}/dashboard", response_model=SellerDashboardStats)
def get_seller_dashboard_stats(
    seller_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get dashboard statistics for a specific seller (admin only)"""
    seller = db.query(User).filter(User.id == seller_id, User.is_seller == True).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Продавец не найден")
    
    # Get seller's organization
    organization_id = seller.organization_id
    
    # Orders disabled: order tables/models removed.
    active_orders = []
    new_orders = []
    pending_orders = []
    completed_orders = []
    
    # Get products for this organization
    products = db.query(Product).filter(Product.organization_id == organization_id).all()
    total_products = len(products)
    total_warehouse_value = sum((p.price or 0) * (p.quantity or 0) for p in products)
    total_warehouse_quantity = sum(p.quantity or 0 for p in products)
    
    warehouse_sales = list_warehouse_sales(db, organization_id)
    warehouse_sales_count, total_sales = warehouse_sales_totals(warehouse_sales)
    
    seller_name = f"{seller.last_name} {seller.first_name}".strip()
    if seller.patronymic:
        seller_name += f" {seller.patronymic}"
    
    return SellerDashboardStats(
        seller_id=str(seller.id),
        seller_name=seller_name,
        organization_name=seller.organization.name if seller.organization else None,
        activeOrders=len(active_orders),
        totalProducts=total_products,
        totalWarehouseValue=total_warehouse_value,
        totalWarehouseQuantity=total_warehouse_quantity,
        totalSales=total_sales,
        newOrders=len(new_orders),
        pendingOrders=len(pending_orders),
        completedOrders=len(completed_orders),
        warehouseSalesCount=warehouse_sales_count
    )


def generate_random_password(length=10):
    """Generate a random password with letters and digits"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


@router.post("/pending-sellers/{seller_id}/approve")
def approve_pending_seller(
    seller_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    # Find pending seller
    pending_seller = db.query(PendingSeller).filter(PendingSeller.id == seller_id).first()
    if not pending_seller:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    
    try:
        # Generate random password
        password = generate_random_password(10)
        hashed_password = get_password_hash(password)
        
        # Create organization
        org_id = random_id(10)
        organization = Organization(
            id=org_id,
            name=pending_seller.name_organization,
            address=pending_seller.address_organization
        )
        db.add(organization)
        db.flush()
        
        # Create user
        user = User(
            last_name=pending_seller.last_name,
            first_name=pending_seller.first_name,
            patronymic=pending_seller.patronymic,
            email=pending_seller.email,
            phone=pending_seller.phone,
            is_seller=True,
            is_director=True,
            organization_id=org_id,
            hashed_password=hashed_password
        )
        assign_public_code(user, db)
        db.add(user)
        
        # Remove from pending sellers
        db.delete(pending_seller)
        db.commit()
        db.refresh(user)

        from app.services.organization_chat_service import on_user_joined_organization
        on_user_joined_organization(db, user)
        db.commit()
        
        # Log event
        log_event(
            db,
            event_type="seller_approved",
            user_id=user.id,
            email=user.email,
            details={
                "approved_by": current_user.email,
                "organization_name": organization.name
            }
        )
        
        # Send welcome email to seller with credentials
        try:
            from app.utils.email import send_welcome_email
            send_welcome_email(
                email=user.email,
                full_name=f"{pending_seller.first_name} {pending_seller.last_name}".strip(),
                login=user.email,
                password=password,  # Send the auto-generated password
                organization_name=pending_seller.name_organization
            )
        except Exception as email_error:
            # Log email error but don't fail the approval
            print(f"Failed to send welcome email to {user.email}: {email_error}")
        
        return {
            "msg": "Продавец одобрен и уведомлен по email",
            "user_id": user.id,
            "email": user.email
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка при одобрении заявки")


class RejectSellerRequest(BaseModel):
    reason: Optional[str] = None

@router.post("/pending-sellers/{seller_id}/reject")
def reject_pending_seller(
    seller_id: int,
    request: RejectSellerRequest,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    # Find pending seller
    pending_seller = db.query(PendingSeller).filter(PendingSeller.id == seller_id).first()
    if not pending_seller:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    
    try:
        # Send rejection email to seller
        rejection_reason = request.reason or "Причина не указана"
        email_subject = "Ваша заявка на регистрацию продавца отклонена"
        email_body = f"""
Здравствуйте, {pending_seller.first_name}!

К сожалению, ваша заявка на регистрацию продавца была отклонена.

Причина отказа:
{rejection_reason}

Если у вас возникли вопросы, вы можете связаться с нашей службой поддержки.

С уважением,
Команда AutoParts
"""
        
        try:
            send_verification_email(pending_seller.email, "", subject=email_subject, body=email_body)
        except Exception as email_error:
            # Log email error but don't fail the rejection
            print(f"Failed to send rejection email to {pending_seller.email}: {email_error}")
        
        # Log event
        log_event(
            db,
            event_type="seller_rejected",
            email=pending_seller.email,
            details={
                "rejected_by": current_user.email,
                "reason": rejection_reason
            }
        )
        
        # Remove from pending sellers
        db.delete(pending_seller)
        db.commit()
        
        return {"msg": "Заявка отклонена и уведомление отправлено"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка при отклонении заявки")


class SellerMarkupPatch(BaseModel):
    new_parts_markup_percent: float = Field(..., ge=0, le=500)


class SellerWorkspaceResponse(BaseModel):
    seller_id: int
    seller_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    is_director: bool = False
    is_employee: bool = False
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None
    organization_address: Optional[str] = None
    organization_phone: Optional[str] = None
    organization_description: Optional[str] = None
    global_new_parts_markup_percent: float
    new_parts_markup_percent: float
    new_parts_markup_manual: bool
    stats: SellerDashboardStats
    employees_count: int = 0
    clients_count: int = 0
    vehicles_count: int = 0
    storage_locations_count: int = 0


@router.get("/sellers/{seller_id}", response_model=SellerWorkspaceResponse)
def get_seller_workspace(
    seller_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    seller, org = get_seller_organization(db, seller_id)
    settings_row = get_or_create_site_settings(db)
    stats = get_seller_dashboard_stats(seller_id, current_user, db)

    seller_name = f"{seller.last_name} {seller.first_name}".strip()
    if seller.patronymic:
        seller_name += f" {seller.patronymic}"

    employees_count = db.query(User).filter(
        User.organization_id == org.id,
        User.is_employee.is_(True),
    ).count()
    clients_count = db.query(ClientModel).filter(ClientModel.organization_id == org.id).count()
    vehicles_count = db.query(VehicleModel).filter(VehicleModel.organization_id == org.id).count()
    storage_locations_count = db.query(StorageLocationModel).filter(
        StorageLocationModel.organization_id == org.id
    ).count()

    return SellerWorkspaceResponse(
        seller_id=seller.id,
        seller_name=seller_name,
        email=seller.email,
        phone=seller.phone,
        is_director=bool(seller.is_director),
        is_employee=bool(seller.is_employee),
        organization_id=org.id,
        organization_name=org.name,
        organization_address=org.address,
        organization_phone=org.phone,
        organization_description=org.description,
        global_new_parts_markup_percent=global_markup_percent(settings_row),
        new_parts_markup_percent=effective_markup_percent(org, settings_row),
        new_parts_markup_manual=bool(getattr(org, "new_parts_markup_manual", False)),
        stats=stats,
        employees_count=employees_count,
        clients_count=clients_count,
        vehicles_count=vehicles_count,
        storage_locations_count=storage_locations_count,
    )


@router.patch("/sellers/{seller_id}/markup")
def patch_seller_markup(
    seller_id: int,
    payload: SellerMarkupPatch,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    _seller, org = get_seller_organization(db, seller_id)
    org.new_parts_markup_percent = float(payload.new_parts_markup_percent)
    org.new_parts_markup_manual = True
    db.commit()
    db.refresh(org)
    settings_row = get_or_create_site_settings(db)
    return {
        "organization_id": org.id,
        "new_parts_markup_percent": effective_markup_percent(org, settings_row),
        "new_parts_markup_manual": True,
        "global_new_parts_markup_percent": global_markup_percent(settings_row),
    }


@router.post("/sellers/{seller_id}/markup/reset")
def reset_seller_markup(
    seller_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    _seller, org = get_seller_organization(db, seller_id)
    settings_row = get_or_create_site_settings(db)
    global_value = global_markup_percent(settings_row)
    org.new_parts_markup_percent = global_value
    org.new_parts_markup_manual = False
    db.commit()
    db.refresh(org)
    return {
        "organization_id": org.id,
        "new_parts_markup_percent": global_value,
        "new_parts_markup_manual": False,
        "global_new_parts_markup_percent": global_value,
    }


def _org_id_from_seller(db: Session, seller_id: int) -> str:
    _seller, org = get_seller_organization(db, seller_id)
    return org.id


def _seller_product_query_options():
    from app.models.product import Product as ProductModel

    return (
        selectinload(ProductModel.photos),
        selectinload(ProductModel.videos),
        selectinload(ProductModel.compatible_vehicles).options(
            selectinload(VehicleModel.vin_row),
            selectinload(VehicleModel.mileage_row),
        ),
        selectinload(ProductModel.storage_location),
        selectinload(ProductModel.organization),
        selectinload(ProductModel.avito_listing_links),
        selectinload(ProductModel.drom_listing_links),
    )


def _apply_product_flags(product) -> None:
    if product is None:
        return
    product.is_on_avito = len(product.avito_listing_links or []) > 0
    product.is_on_drom = len(product.drom_listing_links or []) > 0


@router.get("/sellers/{seller_id}/products")
def get_seller_products(
    seller_id: int,
    storage_location_id: Optional[int] = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    from app.models.product import Product as ProductModel

    org_id = _org_id_from_seller(db, seller_id)
    query = (
        db.query(ProductModel)
        .options(*_seller_product_query_options())
        .filter(ProductModel.organization_id == org_id)
    )
    if storage_location_id is not None:
        query = query.filter(ProductModel.storage_location_id == storage_location_id)
    products = query.all()
    for product in products:
        _apply_product_flags(product)
    return products


@router.get("/sellers/{seller_id}/products/{product_id}")
def get_seller_product(
    seller_id: int,
    product_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    from app.models.product import Product as ProductModel

    org_id = _org_id_from_seller(db, seller_id)
    product = (
        db.query(ProductModel)
        .options(*_seller_product_query_options())
        .filter(
            ProductModel.id == product_id,
            ProductModel.organization_id == org_id,
        )
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Запчасть не найдена")
    _apply_product_flags(product)
    return product


@router.get("/sellers/{seller_id}/clients", response_model=List[ClientListItemResponse])
def get_seller_clients(
    seller_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Buyers with orders for the seller's organization."""
    _, org = get_seller_organization(db, seller_id)
    return list_buyers_for_organization(db, org.id, org.name)


@router.get("/sellers/{seller_id}/clients/buyer-orders", response_model=ClientBuyerOrdersResponse)
def get_seller_client_buyer_orders(
    seller_id: int,
    client_id: Optional[int] = Query(None),
    email: Optional[str] = Query(None),
    phone: Optional[str] = Query(None),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Orders of a buyer for the seller's organization."""
    _, org = get_seller_organization(db, seller_id)
    return get_buyer_orders_for_organization(
        db,
        org.id,
        client_id=client_id,
        email=email,
        phone=phone,
    )


@router.get("/sellers/{seller_id}/vehicles")
def get_seller_vehicles(
    seller_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    org_id = _org_id_from_seller(db, seller_id)
    return (
        db.query(VehicleModel)
        .options(
            selectinload(VehicleModel.vin_row),
            selectinload(VehicleModel.mileage_row),
            selectinload(VehicleModel.photos),
        )
        .filter(VehicleModel.organization_id == org_id)
        .all()
    )


@router.get("/sellers/{seller_id}/storage-locations")
def get_seller_storage_locations(
    seller_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    org_id = _org_id_from_seller(db, seller_id)
    return db.query(StorageLocationModel).filter(StorageLocationModel.organization_id == org_id).all()


@router.get("/sellers/{seller_id}/stock-ins")
def get_seller_stock_ins(
    seller_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    from app.models.stock_in import StockIn as StockInModel

    org_id = _org_id_from_seller(db, seller_id)
    rows = (
        db.query(StockInModel)
        .options(
            joinedload(StockInModel.product).options(*_seller_product_query_options()),
            joinedload(StockInModel.storage_location),
            joinedload(StockInModel.creator),
        )
        .filter(StockInModel.organization_id == org_id)
        .all()
    )
    for row in rows:
        _apply_product_flags(row.product)
    return rows


@router.get("/sellers/{seller_id}/stock-outs")
def get_seller_stock_outs(
    seller_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    org_id = _org_id_from_seller(db, seller_id)
    rows = (
        db.query(StockOut)
        .options(
            joinedload(StockOut.product).options(*_seller_product_query_options()),
            joinedload(StockOut.storage_location),
            joinedload(StockOut.user),
        )
        .filter(StockOut.organization_id == org_id)
        .all()
    )
    for row in rows:
        _apply_product_flags(row.product)
    return rows


@router.get("/sellers/{seller_id}/warehouse-sales")
def get_seller_warehouse_sales(
    seller_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    org_id = _org_id_from_seller(db, seller_id)
    rows = list_warehouse_sales(db, org_id)
    for row in rows:
        _apply_product_flags(row.product)
    return rows


@router.get("/sellers/{seller_id}/employees")
def get_seller_employees(
    seller_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    org_id = _org_id_from_seller(db, seller_id)
    return db.query(User).filter(User.organization_id == org_id).all()


@router.get("/seo/sitemaps")
def list_site_sitemaps(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    integration = get_or_create_yandex_integration(db)
    site_origin = integration.host_url or "https://svoygarage.ru"
    return {
        "site_origin": site_origin.rstrip("/"),
        "items": get_site_sitemap_files(db, preferred_host_url=integration.host_url),
        "products_cache": get_products_sitemap_cache_meta(db),
        "new_parts_cache": get_new_parts_sitemap_cache_meta(db),
    }


@router.post("/seo/sitemaps/rebuild")
def rebuild_sitemaps(
    scope: str = Query(
        "new_parts",
        description="new_parts — только Rossko (/autoparts/new); products — каталог; all — оба",
    ),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    normalized_scope = (scope or "new_parts").strip().lower()
    if normalized_scope not in {"new_parts", "products", "all"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="scope must be one of: new_parts, products, all",
        )

    integration = get_or_create_yandex_integration(db)
    host = integration.host_url
    result: dict[str, object] = {"ok": True, "scope": normalized_scope}

    if normalized_scope in {"products", "all"}:
        products_snapshot = rebuild_products_sitemap_cache(db, preferred_host_url=host)
        result["products"] = {
            "url_count": products_snapshot.url_count,
            "generated_at": products_snapshot.generated_at.isoformat(),
        }

    if normalized_scope in {"new_parts", "all"}:
        new_parts_snapshot = rebuild_new_parts_sitemap_cache(db, preferred_host_url=host)
        result["new_parts"] = {
            "url_count": new_parts_snapshot.url_count,
            "generated_at": new_parts_snapshot.generated_at.isoformat(),
        }

    return result


@router.post("/seo/new-parts/sync-from-products")
async def sync_new_parts_seo_from_products_endpoint(
    limit: int = Query(100, ge=1, le=500, description="Максимум новых SEO-карточек за сутки"),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    from dataclasses import asdict

    from app.services.new_parts_seo_sync_service import sync_new_parts_seo_from_products

    integration = get_or_create_yandex_integration(db)
    host = integration.host_url
    sync_stats = await sync_new_parts_seo_from_products(db, daily_limit=limit)
    new_parts_snapshot = rebuild_new_parts_sitemap_cache(db, preferred_host_url=host)
    return {
        "ok": True,
        "sync": asdict(sync_stats),
        "new_parts": {
            "url_count": new_parts_snapshot.url_count,
            "generated_at": new_parts_snapshot.generated_at.isoformat(),
        },
    }


@router.get("/seo/product-card-urls")
def download_product_card_urls(
    limit: int = Query(DEFAULT_PRODUCT_URLS_LIMIT, ge=1, le=500),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    integration = get_or_create_yandex_integration(db)
    used_items, rossko_items, export_date, _created, _pool_reset = get_daily_seo_url_batch(
        db,
        limit=limit,
        preferred_host_url=integration.host_url,
    )
    if not used_items and not rossko_items:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Нет карточек б/у или Rossko для формирования списка URL",
        )

    content = generate_product_urls_text_file(
        db,
        limit=limit,
        preferred_host_url=integration.host_url,
        used_items=used_items,
        rossko_items=rossko_items,
        export_date=export_date,
        created_new_batch=_created,
        pool_was_reset=_pool_reset,
    )
    total_count = len(used_items) + len(rossko_items)
    filename = f"seo-card-urls-{export_date.isoformat()}-{total_count}.txt"
    return Response(
        content=content,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )