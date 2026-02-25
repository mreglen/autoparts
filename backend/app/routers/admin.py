# app/routers/admin.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.models.event_log import EventLog
from app.models.user import User
from app.models.organization import Organization
from app.models.pending_seller import PendingSeller
from app.models.product import Product
from app.models.stock_out import StockOut
from app.db.database import get_db
from app.schemas.event_log import EventLogResponse
from app.schemas.user import UserResponse, UserUpdate
from app.schemas.organization import Organization as OrganizationSchema, OrganizationCreate, OrganizationUpdate
from typing import List, Optional
from pydantic import BaseModel
from app.core.auth import get_current_admin_user
from app.core.security import get_password_hash
from app.utils.id_generator import random_id
from app.utils.event_logger import log_event
from app.utils.email import send_verification_email, send_welcome_email
import secrets
import string 
from datetime import datetime, timedelta

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get("/users", response_model=List[UserResponse])
def get_all_users(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    users = db.query(User).all()
    return users


@router.get("/events", response_model=List[EventLogResponse])
def get_event_log(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    events = db.query(EventLog).order_by(EventLog.created_at.desc()).all()
    return events

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
            "organization_id": seller.organization_id
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
    
    # Get orders where items belong to this seller's organization
    # We need to join Order with OrderItem to find orders containing items from this organization
    from app.models.orders import Order, OrderItem
    orders = db.query(Order).join(Order.items).filter(OrderItem.seller_organization_id == organization_id).distinct().all()
    
    # Filter orders from new parts (Rossko) - exclude them
    filtered_orders = [order for order in orders if order.new_parts_order is None]
    
    # Calculate order statistics
    active_orders = [o for o in filtered_orders if o.status.code not in ['closed', 'cancelled']]
    
    seven_days_ago = datetime.now() - timedelta(days=7)
    new_orders = [o for o in filtered_orders if o.created_at > seven_days_ago]
    
    pending_orders = [o for o in filtered_orders if o.status.code == 'pending']
    completed_orders = [o for o in filtered_orders if o.status.code in ['delivered', 'closed']]
    
    # Get products for this organization
    products = db.query(Product).filter(Product.organization_id == organization_id).all()
    total_products = len(products)
    total_warehouse_value = sum((p.price or 0) * (p.quantity or 0) for p in products)
    total_warehouse_quantity = sum(p.quantity or 0 for p in products)
    
    # Get warehouse sales for this organization
    warehouse_sales = db.query(StockOut).filter(
        StockOut.organization_id == organization_id,
        StockOut.sale_price > 0
    ).all()
    warehouse_sales_count = len(warehouse_sales)
    total_sales = sum(float(s.sale_price or 0) * int(s.quantity or 0) for s in warehouse_sales)
    
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
        db.add(user)
        
        # Remove from pending sellers
        db.delete(pending_seller)
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