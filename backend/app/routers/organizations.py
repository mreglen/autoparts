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
from app.models.orders import OrderStatus, OrderItemStatus

router = APIRouter(prefix="/organizations", tags=["Organizations"])

def init_order_item_statuses(db: Session):
    """Инициализация статусов элементов заказа"""
    statuses = [
        {"name": "В ожидании", "code": "pending"},
        {"name": "Подтверждён", "code": "confirmed"},
        {"name": "Не подтверждён", "code": "rejected"},
        {"name": "Сформирован", "code": "assembled"},
        {"name": "Передан в доставку", "code": "shipped"},
        {"name": "Получен", "code": "delivered"},
        {"name": "Закрыт", "code": "closed"}
    ]

    for status_data in statuses:
        existing = db.query(OrderItemStatus).filter(OrderItemStatus.code == status_data["code"]).first()
        if not existing:
            status = OrderItemStatus(name=status_data["name"], code=status_data["code"])
            db.add(status)

    db.commit()

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

    # 5. Удаляем
    db.delete(employee)
    db.commit()

    return

@router.post("/{org_id}/employees", response_model=UserResponse)
def add_employee(org_id: str, employee: EmployeeCreate, db: Session = Depends(get_db)):
   
    org = db.query(OrganizationModel).filter(OrganizationModel.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Организация не найдена")

  
    if db.query(UserModel).filter(UserModel.email == employee.email).first():
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")

    normalized_phone = normalize_to_storage_format(employee.phone)
    if not normalized_phone:
        raise HTTPException(status_code=400, detail="Неверный формат телефона")

  
    new_user = UserModel(
        last_name=employee.last_name,
        first_name=employee.first_name,
        patronymic=employee.patronymic,
        email=employee.email,
        phone=normalized_phone,
        hashed_password=get_password_hash(employee.password),
        is_seller=True,            
        is_buyer=False,
        is_director=False,         
        organization_id=org_id,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

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
    return db_org

@router.get("/{org_id}", response_model=OrganizationSchema)
def read_organization(org_id: str, db: Session = Depends(get_db)):
    org = db.query(OrganizationModel).filter(OrganizationModel.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Организация не найдена")
    return org

@router.put("/{org_id}", response_model=OrganizationSchema)
def update_organization(org_id: str, org: OrganizationUpdate, db: Session = Depends(get_db)):
    db_org = db.query(OrganizationModel).filter(OrganizationModel.id == org_id).first()
    if not db_org:
        raise HTTPException(status_code=404, detail="Организация не найдена")

    # Обновляем только переданные поля
    update_data = org.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_org, key, value)

    db.commit()
    db.refresh(db_org)
    return db_org

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
    try:
        # Инициализируем статусы элементов заказов
        init_order_item_statuses(db)

        return {"message": "Статусы элементов заказов успешно инициализированы"}

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка инициализации статусов элементов заказов: {str(e)}"
        )