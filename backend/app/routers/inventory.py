from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.permission import Permission
from app.models.user import User as UserModel
from app.models.user_permission import UserPermission
from app.schemas.inventory import (
    InventoryAdjustmentReport,
    InventoryCompleteRequest,
    InventoryCompleteResponse,
    InventoryCountLineBulkUpdate,
    InventoryCountLineUpdate,
    InventorySessionCreate,
    InventorySessionListItem,
    InventorySessionResponse,
)
from app.services.inventory_service import (
    bulk_update_inventory_count_lines,
    complete_inventory_session,
    create_inventory_session,
    get_inventory_adjustment_report,
    get_inventory_session,
    list_inventory_sessions,
    update_inventory_count_line,
)

router = APIRouter(prefix="/inventory", tags=["Inventory"])

INVENTORY_VIEW = "inventory.view"
INVENTORY_CREATE = "inventory.create"
INVENTORY_ADJUST = "inventory.adjust"
INVENTORY_COMPLETE = "inventory.complete"


def _has_permission(db: Session, user: UserModel, code: str) -> bool:
    if user.is_admin or user.is_seller or user.is_director:
        return True
    if not user.is_employee:
        return False
    q = (
        db.query(Permission.code)
        .join(UserPermission, UserPermission.permission_id == Permission.id)
        .filter(UserPermission.user_id == user.id, Permission.code == code)
    )
    return db.query(q.exists()).scalar() is True


def _require_org(user: UserModel) -> str:
    if not user.organization_id:
        raise HTTPException(status_code=400, detail="У пользователя нет organization_id")
    return user.organization_id


def _require_view(db: Session, user: UserModel) -> str:
    if not _has_permission(db, user, INVENTORY_VIEW):
        raise HTTPException(status_code=403, detail="Нет доступа к инвентаризации")
    return _require_org(user)


def _require_create(db: Session, user: UserModel) -> str:
    if not _has_permission(db, user, INVENTORY_CREATE):
        raise HTTPException(status_code=403, detail="Нет права создавать инвентаризацию")
    return _require_org(user)


def _require_adjust(db: Session, user: UserModel) -> str:
    if not _has_permission(db, user, INVENTORY_ADJUST):
        raise HTTPException(status_code=403, detail="Нет права вносить результаты подсчёта")
    return _require_org(user)


def _require_complete(db: Session, user: UserModel) -> str:
    if not _has_permission(db, user, INVENTORY_COMPLETE):
        raise HTTPException(status_code=403, detail="Нет права завершать инвентаризацию")
    return _require_org(user)


@router.get("/sessions", response_model=list[InventorySessionListItem])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    org_id = _require_view(db, current_user)
    return list_inventory_sessions(db, org_id)


@router.post("/sessions", response_model=InventorySessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    body: InventorySessionCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    org_id = _require_create(db, current_user)
    return create_inventory_session(db, organization_id=org_id, user=current_user, payload=body)


@router.get("/sessions/{session_id}", response_model=InventorySessionResponse)
def read_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    org_id = _require_view(db, current_user)
    return get_inventory_session(db, org_id, session_id)


@router.patch("/sessions/{session_id}/lines/{line_id}", response_model=InventorySessionResponse)
def patch_count_line(
    session_id: int,
    line_id: int,
    body: InventoryCountLineUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    org_id = _require_adjust(db, current_user)
    return update_inventory_count_line(
        db,
        organization_id=org_id,
        session_id=session_id,
        line_id=line_id,
        counted_qty=body.counted_qty,
        line_status=body.line_status,
    )


@router.post("/sessions/{session_id}/lines/bulk", response_model=InventorySessionResponse)
def bulk_patch_count_lines(
    session_id: int,
    body: InventoryCountLineBulkUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    org_id = _require_adjust(db, current_user)
    updates = [{"line_id": item.line_id, "counted_qty": item.counted_qty, "line_status": item.line_status} for item in body.lines]
    return bulk_update_inventory_count_lines(
        db,
        organization_id=org_id,
        session_id=session_id,
        updates=updates,
    )


@router.get("/sessions/{session_id}/adjustment-report", response_model=InventoryAdjustmentReport)
def adjustment_report(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    org_id = _require_view(db, current_user)
    return get_inventory_adjustment_report(db, org_id, session_id)


@router.post("/sessions/{session_id}/complete", response_model=InventoryCompleteResponse)
def complete_session(
    session_id: int,
    body: InventoryCompleteRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    org_id = _require_complete(db, current_user)
    return complete_inventory_session(
        db,
        organization_id=org_id,
        user=current_user,
        session_id=session_id,
        apply_adjustments=body.apply_adjustments,
        notes=body.notes,
    )
