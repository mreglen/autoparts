from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List

from app.core.auth import get_current_user
from app.models.user import User as UserModel
from app.models.permission import Permission
from app.models.user_permission import UserPermission
from app.models.user_session import UserSession
from app.schemas.employee import (
    EmployeeCreate, 
    EmployeeResponse, 
    EmployeeUpdate, 
    EmployeeRegistrationStep1, 
    PermissionAssignRequest, 
    PermissionResponse
)
from app.schemas.audit import PermissionsContextResponse
from app.db.database import get_db
from app.services.audit_service import log_audit
from app.utils.user_public_code import assign_public_code
from app.utils.org_access import (
    ADMIN_AUDIT_PERMISSION_CODE,
    SETTINGS_INTEGRATION_AVITO_PERMISSION_CODE,
    org_has_admin_director,
)

router = APIRouter(prefix="/employees", tags=["Employees"])

def _ensure_default_permissions(db: Session) -> None:
    try:
        db.execute(
            text(
                """
                SELECT setval(
                    pg_get_serial_sequence('permissions', 'id'),
                    COALESCE((SELECT MAX(id) FROM permissions), 1),
                    true
                )
                """
            )
        )
    except Exception:
        db.rollback()

    # Backward compatibility: migrate old print permission code if present.
    legacy_print_perm = db.query(Permission).filter(Permission.code == "printers").first()
    if legacy_print_perm:
        legacy_print_perm.code = "settings.printers"
        if not legacy_print_perm.name:
            legacy_print_perm.name = "Печать"

    defaults = [
        {"code": "sellers", "name": "Продавцы"},
        {"code": "settings.printers", "name": "Печать"},
        {"code": "vehicles", "name": "Автомобили"},
        {"code": "sales.orders", "name": "Заказы"},
        {"code": "sales.returns", "name": "Возвраты"},
        {"code": "finance.reports", "name": "Финансовые отчёты"},
        {
            "code": SETTINGS_INTEGRATION_AVITO_PERMISSION_CODE,
            "name": "Интеграция Авито",
        },
        {"code": ADMIN_AUDIT_PERMISSION_CODE, "name": "Журнал событий"},
        {"code": "inventory.view", "name": "Инвентаризация: просмотр"},
        {"code": "inventory.create", "name": "Инвентаризация: создание"},
        {"code": "inventory.adjust", "name": "Инвентаризация: подсчёт"},
        {"code": "inventory.complete", "name": "Инвентаризация: завершение"},
    ]
    for perm in defaults:
        existing = db.query(Permission).filter(Permission.code == perm["code"]).first()
        if not existing:
            db.add(Permission(code=perm["code"], name=perm["name"]))
    db.commit()


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
    assign_public_code(db_employee, db)
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)

    log_audit(
        db,
        event_type="employee_created",
        category="employees",
        summary=f"Создан сотрудник {db_employee.email}",
        user=current_user,
        organization_id=org_id,
        details={"employee_id": db_employee.id, "employee_email": db_employee.email},
        entity_type="user",
        entity_id=db_employee.id,
    )

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

    audit_perm = db.query(Permission).filter(Permission.code == ADMIN_AUDIT_PERMISSION_CODE).first()
    if audit_perm and audit_perm.id in permission_request.permission_ids:
        if not org_has_admin_director(db, current_user.organization_id):
            raise HTTPException(
                status_code=403,
                detail="Право «Журнал событий» доступно только в организациях с admin-директором",
            )

    assigned_codes: list[str] = []
    # Remove existing permissions
    db.query(UserPermission).filter(UserPermission.user_id == employee_id).delete()
    
    # Add new permissions
    for perm_id in permission_request.permission_ids:
        permission_exists = db.query(Permission).filter(Permission.id == perm_id).first()
        if permission_exists:
            user_perm = UserPermission(user_id=employee_id, permission_id=perm_id)
            db.add(user_perm)
            assigned_codes.append(permission_exists.code)

    db.commit()
    
    # Deactivate all active sessions for this employee to force re-login
    # This ensures the employee gets new permissions on next login
    db.query(UserSession).filter(
        UserSession.user_id == employee_id,
        UserSession.is_active == True
    ).update({"is_active": False})
    db.commit()

    log_audit(
        db,
        event_type="employee_permissions_changed",
        category="employees",
        summary=f"Изменены права сотрудника {employee.email}",
        user=current_user,
        organization_id=current_user.organization_id,
        details={
            "employee_id": employee_id,
            "permission_codes": assigned_codes,
        },
        entity_type="user",
        entity_id=employee_id,
    )

    return {"message": "Permissions assigned successfully"}


@router.get("/permissions/all", response_model=List[PermissionResponse])
def get_all_permissions(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all available permissions"""
    _ensure_default_permissions(db)
    permissions = db.query(Permission).all()
    if current_user.is_admin:
        return permissions
    if not org_has_admin_director(db, current_user.organization_id):
        permissions = [p for p in permissions if p.code != ADMIN_AUDIT_PERMISSION_CODE]
    return permissions


@router.get("/permissions/context", response_model=PermissionsContextResponse)
def get_permissions_context(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return PermissionsContextResponse(
        org_has_admin_director=org_has_admin_director(db, current_user.organization_id),
    )


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
    
    # Idempotent init (also used by GET /permissions/all)
    before = {p.code for p in db.query(Permission.code).all()}
    _ensure_default_permissions(db)
    after = {p.code for p in db.query(Permission.code).all()}
    created_codes = sorted(list(after - before))
    return {"message": "Permissions initialized", "created": created_codes}


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