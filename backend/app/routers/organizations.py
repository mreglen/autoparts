from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.auth import get_current_user, get_current_admin_user
from app.core.security import get_password_hash
from app.models.organization import Organization as OrganizationModel
from app.schemas.organization import Organization as OrganizationSchema, OrganizationCreate, OrganizationUpdate
from app.db.database import get_db
from app.models.user import User as UserModel
from app.schemas.user import EmployeeCreate, UserResponse, UserUpdate
from app.utils.id_generator import random_id
from app.utils.phone import normalize_to_storage_format
from app.utils.event_logger import log_event
from app.services.audit_service import log_audit
from app.utils.user_public_code import assign_public_code
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/organizations", tags=["Organizations"])

def init_order_item_statuses(db: Session):
    """Инициализация статусов элементов заказа (отключено)."""
    # Заказы полностью удалены: таблицы и ORM-модели больше не существуют.
    # Оставляем функцию, чтобы старые вызовы не ломали импорт/запуск.
    return

@router.put("/{org_id}/employees/{user_id}", response_model=UserResponse)
def update_employee(
    org_id: str,
    user_id: int,
    update_data: UserUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Проверка организации
    org = db.query(OrganizationModel).filter(OrganizationModel.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Организация не найдена")

    # 2. Проверка прав
    if current_user.organization_id != org_id or not current_user.is_director:
        raise HTTPException(status_code=403, detail="Только директор может редактировать сотрудников")

    # 3. Найти сотрудника
    employee = db.query(UserModel).filter(
        UserModel.id == user_id,
        UserModel.organization_id == org_id
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    # 4. Обновить поля
    for field, value in update_data.dict(exclude_unset=True).items():
        if field == "password" and value is not None:
            employee.hashed_password = get_password_hash(value)
        elif field in ("last_name", "first_name", "patronymic", "email", "phone"):
            setattr(employee, field, value)

    db.commit()
    db.refresh(employee)
    return employee

@router.delete("/{org_id}/employees/{user_id}")
def remove_employee(
    org_id: str,
    user_id: int,
    current_user: UserResponse = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    org = db.query(OrganizationModel).filter(OrganizationModel.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Организация не найдена")

    if current_user.organization_id != org_id or not current_user.is_director:
        raise HTTPException(status_code=403, detail="Доступ запрещён: только директор может управлять сотрудниками")

    employee = db.query(UserModel).filter(
        UserModel.id == user_id,
        UserModel.organization_id == org_id
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден в этой организации")

    if employee.id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя удалить самого себя")

    from app.services.organization_chat_service import on_user_left_organization
    on_user_left_organization(db, user_id, org_id)

    # Delete related data first (cascading delete)
    from app.models.user_permission import UserPermission
    from app.models.user_session import UserSession
    from app.models.carts import Cart, NewPartsCart, UsedPartsCart
    from app.models.pending_product import PendingProduct
    from app.models.product import Product
    from app.models.rejected_product import RejectedProduct
    from app.models.stock_in import StockIn
    from app.models.stock_out import StockOut
    
    # Delete user permissions
    db.query(UserPermission).filter(UserPermission.user_id == user_id).delete()
    
    # Delete user sessions
    db.query(UserSession).filter(UserSession.user_id == user_id).delete()
    
    # Delete user's carts
    db.query(Cart).filter(Cart.user_id == user_id).delete()
    db.query(NewPartsCart).filter(NewPartsCart.user_id == user_id).delete()
    db.query(UsedPartsCart).filter(UsedPartsCart.user_id == user_id).delete()
    
    # Delete user's stock out records
    db.query(StockOut).filter(StockOut.user_id == user_id).delete()
    
    # Products created by this user - set created_by to NULL
    db.query(Product).filter(Product.created_by == user_id).update({"created_by": None})
    db.query(PendingProduct).filter(PendingProduct.created_by == user_id).update({"created_by": None})
    db.query(RejectedProduct).filter(RejectedProduct.created_by == user_id).update({"created_by": None})
    
    # Stock in records - set created_by to NULL
    db.query(StockIn).filter(StockIn.created_by == user_id).update({"created_by": None})
    
    # Delete the employee from users table
    db.delete(employee)
    db.commit()

    return {"message": "Сотрудник успешно удален"}

@router.post("/{org_id}/employees", response_model=UserResponse)
def add_employee(org_id: str, employee: EmployeeCreate, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    
    # Verify that the current user is authorized to add employees
    if current_user.organization_id != org_id or not current_user.is_director:
        raise HTTPException(status_code=403, detail="Доступ запрещён: только директор может добавлять сотрудников")
    
    org = db.query(OrganizationModel).filter(OrganizationModel.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Организация не найдена")

    # Check if email already exists
    if db.query(UserModel).filter(UserModel.email == employee.email).first():
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")

    # Validate and normalize phone
    normalized_phone = normalize_to_storage_format(employee.phone)
    if not normalized_phone:
        raise HTTPException(status_code=400, detail="Неверный формат телефона")

    # Create new employee
    new_user = UserModel(
        last_name=employee.last_name.strip(),
        first_name=employee.first_name.strip(),
        patronymic=employee.patronymic.strip() if employee.patronymic else None,
        email=employee.email.lower().strip(),
        phone=normalized_phone,
        hashed_password=get_password_hash(employee.password),
        is_seller=False,            
        is_employee=True,
        is_buyer=False,
        is_director=False,         
        organization_id=org_id,
    )
    assign_public_code(new_user, db)
    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Log the event (if logger is available)
        try:
            log_event(
                db,
                event_type="employee_created",
                user_id=current_user.id,
                email=current_user.email,
                details={
                    "employee_id": new_user.id,
                    "employee_email": new_user.email,
                    "organization_id": org_id
                }
            )
        except Exception as log_error:
            logger.warning(f"Failed to log employee creation event: {log_error}")

        from app.services.organization_chat_service import on_user_joined_organization
        on_user_joined_organization(db, new_user)
        db.commit()
        
        return new_user
    except Exception as e:
        db.rollback()
        logger.exception("Ошибка при создании сотрудника")
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")

@router.get("/{org_id}/employees", response_model=list[UserResponse])
def get_organization_employees(org_id: str, db: Session = Depends(get_db)):
    employees = db.query(UserModel).filter(UserModel.organization_id == org_id).all()
    return employees

@router.post("/", response_model=OrganizationSchema)
def create_organization(org: OrganizationCreate, db: Session = Depends(get_db)):
    organization_id = random_id()
    db_org = OrganizationModel(id=organization_id,**org.dict())
    db.add(db_org)
    db.commit()
    db.refresh(db_org)
    
    # Assign default delivery method (ID=1) to the new organization
    from app.models.delivery_method import DeliveryMethod, organization_delivery_methods
    
    # Check if delivery method with ID=1 exists
    default_delivery_method = db.query(DeliveryMethod).filter(DeliveryMethod.id == 1).first()
    if default_delivery_method:
        # Check if this combination already exists
        existing = db.execute(
            organization_delivery_methods.select().where(
                organization_delivery_methods.c.organization_id == organization_id,
                organization_delivery_methods.c.delivery_method_id == 1
            )
        ).fetchone()
        
        if not existing:
            # Add the association for default delivery method
            db.execute(
                organization_delivery_methods.insert().values(
                    organization_id=organization_id,
                    delivery_method_id=1
                )
            )
    
    db.commit()
    
    from app.services.organization_chat_service import ensure_organization_chat
    ensure_organization_chat(db, organization_id)
    db.commit()
    
    return db_org
# 
@router.get("/{org_id}", response_model=OrganizationSchema)
def read_organization(org_id: str, db: Session = Depends(get_db)):
    org = db.query(OrganizationModel).filter(OrganizationModel.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Организация не найдена")
    return org

@router.put("/{org_id}", response_model=OrganizationSchema)
def update_organization(
    org_id: str, 
    org: OrganizationUpdate, 
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_org = db.query(OrganizationModel).filter(OrganizationModel.id == org_id).first()
    if not db_org:
        raise HTTPException(status_code=404, detail="Организация не найдена")

    # Check if user has permission to update this organization
    if current_user.organization_id != org_id or not current_user.is_director:
        raise HTTPException(
            status_code=403, 
            detail="Доступ запрещён: только директор может редактировать организацию"
        )

    # Debug logging
    print(f"=== UPDATE ORGANIZATION DEBUG ===")
    print(f"org_id: {org_id}")
    print(f"Current logo_organization value: {getattr(db_org, 'logo_organization', 'NOT_FOUND')}")
    print(f"Incoming update data: {org.dict(exclude_unset=True)}")
    
    # Check if logo_organization is being updated and delete old logo if needed
    update_data = org.dict(exclude_unset=True)
    if 'logo_organization' in update_data and update_data['logo_organization']:
        old_logo_path = db_org.logo_organization
        new_logo_path = update_data['logo_organization']
        
        # Delete old logo file if it exists and is different from new one
        if old_logo_path and old_logo_path != new_logo_path:
            try:
                # Remove leading slashes for path construction
                old_logo_relative = old_logo_path.lstrip("/").lstrip("\\")
                # Handle paths that may or may not start with 'uploads'
                if not old_logo_relative.lower().startswith("uploads"):
                    old_logo_file_path = os.path.join("uploads", old_logo_relative)
                else:
                    old_logo_file_path = old_logo_relative
                
                print(f"Attempting to delete old logo: {old_logo_file_path}")
                if os.path.exists(old_logo_file_path):
                    os.remove(old_logo_file_path)
                    print(f"✓ Old logo deleted: {old_logo_file_path}")
                else:
                    print(f"⚠️ Old logo file not found: {old_logo_file_path}")
            except Exception as e:
                print(f"⚠️ Error deleting old logo: {e}")
                # Don't fail the update if logo deletion fails
    
    # Обновляем только переданные поля
    for key, value in update_data.items():
        print(f"Setting {key} = {value}")
        setattr(db_org, key, value)

    db.commit()
    db.refresh(db_org)
    log_audit(
        db,
        event_type="organization_updated",
        category="settings",
        summary=f"Организация обновлена: {db_org.name or org_id}",
        user=current_user,
        organization_id=org_id,
        details={"organization_id": org_id, "updated_fields": list(update_data.keys())},
        entity_type="organization",
        entity_id=org_id,
    )
    print(f"After update - logo_organization value: {getattr(db_org, 'logo_organization', 'NOT_FOUND')}")
    print(f"Full updated organization: {db_org.__dict__}")
    print("=== END UPDATE ORGANIZATION DEBUG ===")
    return db_org


@router.post("/{org_id}/assign-default-delivery-methods")
def assign_default_delivery_methods(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Assign default delivery methods to an organization
    """
    # Check if user has permission to modify this organization
    org = db.query(OrganizationModel).filter(OrganizationModel.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Организация не найдена")

    # Verify user has permission to modify this organization
    if (current_user.organization_id != org_id and 
        not current_user.is_admin and 
        not current_user.is_director):
        raise HTTPException(
            status_code=403, 
            detail="Нет прав для изменения способов доставки этой организации"
        )
    
    # Get all delivery methods
    from app.models.delivery_method import DeliveryMethod, organization_delivery_methods
    all_delivery_methods = db.query(DeliveryMethod).all()
    
    # Assign all delivery methods to this organization
    for dm in all_delivery_methods:
        # Check if this combination already exists
        existing = db.execute(
            organization_delivery_methods.select().where(
                organization_delivery_methods.c.organization_id == org_id,
                organization_delivery_methods.c.delivery_method_id == dm.id
            )
        ).fetchone()
        
        if not existing:
            # Add the association
            db.execute(
                organization_delivery_methods.insert().values(
                    organization_id=org_id,
                    delivery_method_id=dm.id
                )
            )
    
    db.commit()
    
    # Also ensure the default delivery method (ID=1) is always assigned
    from app.models.delivery_method import DeliveryMethod, organization_delivery_methods
    
    # Check if delivery method with ID=1 exists
    default_delivery_method = db.query(DeliveryMethod).filter(DeliveryMethod.id == 1).first()
    if default_delivery_method:
        # Check if this combination already exists
        existing = db.execute(
            organization_delivery_methods.select().where(
                organization_delivery_methods.c.organization_id == org_id,
                organization_delivery_methods.c.delivery_method_id == 1
            )
        ).fetchone()
        
        if not existing:
            # Add the association for default delivery method
            db.execute(
                organization_delivery_methods.insert().values(
                    organization_id=org_id,
                    delivery_method_id=1
                )
            )
    
    db.commit()
    
    return {"message": "Default delivery methods assigned successfully"}

@router.delete("/{org_id}", status_code=204)
def delete_organization(org_id: str, db: Session = Depends(get_db)):
    db_org = db.query(OrganizationModel).filter(OrganizationModel.id == org_id).first()
    if not db_org:
        raise HTTPException(status_code=404, detail="Организация не найдена")

    db.delete(db_org)
    db.commit()
    return

@router.post("/init-order-item-statuses")
async def initialize_order_item_statuses(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_admin_user)  # Только для админов
):
    """Инициализация статусов элементов заказов (только для админов)"""
    return {"message": "Заказы отключены: инициализация статусов элементов заказа недоступна"}