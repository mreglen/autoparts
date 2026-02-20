from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.auth import get_current_user
from app.models.user import User as UserModel
from app.models.permission import Permission
from app.models.user_permission import UserPermission
from app.schemas.employee import (
    EmployeeCreate, 
    EmployeeResponse, 
    EmployeeUpdate, 
    EmployeeRegistrationStep1, 
    PermissionAssignRequest, 
    PermissionResponse
)
from app.db.database import get_db

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.get("/organization/{org_id}", response_model=List[EmployeeResponse])
def get_employees(
    org_id: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all employees for the specified organization"""
    if not current_user.is_director or current_user.organization_id != org_id:
        raise HTTPException(
            status_code=403,
            detail="Только директор может просматривать сотрудников своей организации"
        )
        
    employees = db.query(UserModel).filter(
        UserModel.organization_id == org_id,
        UserModel.is_employee == True
    ).all()
    
    return employees


@router.post("/organization/{org_id}", response_model=EmployeeResponse)
def create_employee(
    org_id: str,
    employee: EmployeeCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new employee for the organization"""
    if not current_user.is_director or current_user.organization_id != org_id:
        raise HTTPException(
            status_code=403,
            detail="Только директор может создавать сотрудников своей организации"
        )
        
    # Check if user with this email already exists
    existing_user = db.query(UserModel).filter(UserModel.email == employee.email).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Пользователь с такой почтой уже существует"
        )
    
    # Create new employee
    from app.core.security import get_password_hash
    hashed_password = get_password_hash(employee.password)
    
    db_employee = UserModel(
        last_name=employee.last_name,
        first_name=employee.first_name,
        patronymic=employee.patronymic,
        email=employee.email,
        phone=employee.phone,
        is_director=employee.is_director,
        is_employee=True,  # Mark as employee
        organization_id=org_id,
        hashed_password=hashed_password
    )
    
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    
    return db_employee


@router.get("/{employee_id}", response_model=EmployeeResponse)
def get_employee(
    employee_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get employee information"""
    if not current_user.is_director:
        raise HTTPException(
            status_code=403,
            detail="Только директор может просматривать информацию о сотруднике"
        )
    
    employee = db.query(UserModel).filter(
        UserModel.id == employee_id,
        UserModel.organization_id == current_user.organization_id,
        UserModel.is_employee == True
    ).first()
    
    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    
    return employee


@router.put("/{employee_id}/permissions")
def assign_permissions_to_employee(
    employee_id: int,
    permission_request: PermissionAssignRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Assign permissions to an employee"""
    if not current_user.is_director:
        raise HTTPException(
            status_code=403,
            detail="Только директор может назначать права сотрудникам"
        )
    
    # Verify employee belongs to the same organization
    employee = db.query(UserModel).filter(
        UserModel.id == employee_id,
        UserModel.organization_id == current_user.organization_id,
        UserModel.is_employee == True
    ).first()
    
    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    
    # Remove existing permissions
    db.query(UserPermission).filter(UserPermission.user_id == employee_id).delete()
    
    # Add new permissions
    for perm_id in permission_request.permission_ids:
        permission_exists = db.query(Permission).filter(Permission.id == perm_id).first()
        if permission_exists:
            user_perm = UserPermission(user_id=employee_id, permission_id=perm_id)
            db.add(user_perm)
    
    db.commit()
    
    return {"message": "Permissions assigned successfully"}


@router.get("/permissions/all", response_model=List[PermissionResponse])
def get_all_permissions(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all available permissions"""
    permissions = db.query(Permission).all()
    return permissions


@router.post("/permissions/init")
def init_permissions(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Initialize default permissions (only for directors)"""
    if not current_user.is_director:
        raise HTTPException(
            status_code=403,
            detail="Только директор может инициализировать права"
        )
    
    # Create default permissions if they don't exist
    default_permissions = [
        {"id": 1, "code": "sellers", "name": "Продавцы"},
    ]
    
    created = []
    for perm_data in default_permissions:
        existing = db.query(Permission).filter(Permission.id == perm_data["id"]).first()
        if not existing:
            permission = Permission(
                id=perm_data["id"],
                code=perm_data["code"],
                name=perm_data["name"]
            )
            db.add(permission)
            created.append(perm_data)
    
    db.commit()
    return {"message": "Permissions initialized", "created": created}


@router.get("/{employee_id}/permissions", response_model=List[int])
def get_employee_permissions(
    employee_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get permissions assigned to an employee"""
    if not current_user.is_director:
        raise HTTPException(
            status_code=403,
            detail="Только директор может просматривать права сотрудников"
        )
    
    # Verify employee belongs to the same organization
    employee = db.query(UserModel).filter(
        UserModel.id == employee_id,
        UserModel.organization_id == current_user.organization_id,
        UserModel.is_employee == True
    ).first()
    
    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    
    # Get permission IDs for the employee
    permissions = db.query(UserPermission.permission_id).filter(
        UserPermission.user_id == employee_id
    ).all()
    
    return [perm_id for (perm_id,) in permissions]