import math
import os

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.user import User as UserModel
from app.schemas.user import User as UserSchema, UserCreate, UserResponse, UserUpdate
from app.services.audit_service import log_audit
from app.utils.user_avatar import (
    ALLOWED_AVATAR_EXTENSIONS,
    ALLOWED_AVATAR_MIME,
    MAX_AVATAR_SIZE,
    avatar_public_url,
    remove_user_avatar,
    save_user_avatar_file,
)
from app.utils.user_public_code import assign_public_code

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("/", response_model=UserSchema)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    if getattr(user, "is_admin", False):
        existing_admin = db.query(UserModel).filter(UserModel.is_admin == True).first()
        if existing_admin:
            raise HTTPException(
                status_code=400,
                detail="Администратор уже существует. Может быть только один администратор.",
            )

    db_user = UserModel(**user.dict())
    assign_public_code(db_user, db)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.put("/me", response_model=UserSchema)
def update_own_profile(
    user_update: UserUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for key, value in user_update.dict(exclude_unset=True).items():
        setattr(current_user, key, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/avatar", response_model=UserResponse)
async def upload_own_avatar(
    file: UploadFile = File(...),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not file.content_type or file.content_type not in ALLOWED_AVATAR_MIME:
        raise HTTPException(status_code=400, detail="Разрешены только изображения (JPEG, PNG, WebP, GIF)")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext and ext not in ALLOWED_AVATAR_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Недопустимый формат изображения")

    file_content = await file.read()
    if len(file_content) > MAX_AVATAR_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Файл слишком большой. Максимум: {MAX_AVATAR_SIZE // 1024 // 1024} MB",
        )

    if not ext:
        ext = ".jpg" if file.content_type == "image/jpeg" else ".png"

    old_url = current_user.avatar_url
    new_url = save_user_avatar_file(current_user.id, file_content, ext)
    current_user.avatar_url = new_url
    db.commit()
    db.refresh(current_user)

    log_audit(
        db,
        event_type="user_avatar_uploaded",
        category="users",
        summary="Аватар пользователя обновлён",
        user=current_user,
        organization_id=current_user.organization_id,
        details={
            "user_id": current_user.id,
            "public_code": current_user.public_code,
            "old_avatar_url": old_url,
            "new_avatar_url": new_url,
        },
        entity_type="user",
        entity_id=current_user.id,
    )

    return _user_to_response(current_user)


@router.delete("/me/avatar", response_model=UserResponse)
def delete_own_avatar(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    old_url = current_user.avatar_url
    if not old_url:
        return _user_to_response(current_user)

    remove_user_avatar(db, current_user)

    log_audit(
        db,
        event_type="user_avatar_removed",
        category="users",
        summary="Аватар пользователя удалён",
        user=current_user,
        organization_id=current_user.organization_id,
        details={
            "user_id": current_user.id,
            "public_code": current_user.public_code,
            "old_avatar_url": old_url,
            "new_avatar_url": None,
        },
        entity_type="user",
        entity_id=current_user.id,
    )

    return _user_to_response(current_user)


def _user_to_response(user: UserModel) -> UserResponse:
    org = user.organization
    return UserResponse(
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
    )


@router.get("/{user_id}", response_model=UserSchema)
def read_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return user


@router.put("/{user_id}", response_model=UserSchema)
def update_user(user_id: int, user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if getattr(user, "is_admin", False) and not db_user.is_admin:
        existing_admin = db.query(UserModel).filter(UserModel.is_admin == True).first()
        if existing_admin:
            raise HTTPException(
                status_code=400,
                detail="Администратор уже существует. Может быть только один администратор.",
            )

    for key, value in user.dict().items():
        setattr(db_user, key, value)

    db.commit()
    db.refresh(db_user)
    return db_user


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    db_user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    db.delete(db_user)
    db.commit()
    return
