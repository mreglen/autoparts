from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.auth import get_current_user
from app.models.user import User as UserModel 
from app.schemas.user import User as UserSchema, UserCreate, UserUpdate  
from app.db.database import get_db
from app.utils.user_public_code import assign_public_code

router = APIRouter(prefix="/users", tags=["Users"])

@router.post("/", response_model=UserSchema)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    # Проверяем, что не создаем второго админа
    if user.is_admin:
        existing_admin = db.query(UserModel).filter(UserModel.is_admin == True).first()
        if existing_admin:
            raise HTTPException(
                status_code=400,
                detail="Администратор уже существует. Может быть только один администратор."
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
    db: Session = Depends(get_db)
):  
    for key, value in user_update.dict(exclude_unset=True).items():
        setattr(current_user, key, value)
    db.commit()
    db.refresh(current_user)
    return current_user


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

    # Проверяем, что не создаем второго админа
    if user.is_admin and not db_user.is_admin:
        existing_admin = db.query(UserModel).filter(UserModel.is_admin == True).first()
        if existing_admin:
            raise HTTPException(
                status_code=400,
                detail="Администратор уже существует. Может быть только один администратор."
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

