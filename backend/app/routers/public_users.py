import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.public_user_profile_service import (
    get_public_buyer_profile,
    get_public_seller_profile,
    get_public_user_profile,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Public users"])


@router.get("/public/users/{public_code}")
def get_public_user(public_code: str, db: Session = Depends(get_db)):
    try:
        profile = get_public_user_profile(db, public_code)
        if not profile:
            raise HTTPException(status_code=404, detail="Профиль не найден")
        return profile
    except HTTPException:
        raise
    except Exception:
        logger.exception("get_public_user failed code=%s", public_code)
        raise HTTPException(status_code=500, detail="Не удалось загрузить профиль")


@router.get("/public/sellers/{public_code}")
def get_public_seller(public_code: str, db: Session = Depends(get_db)):
    try:
        profile = get_public_seller_profile(db, public_code)
        if not profile:
            raise HTTPException(status_code=404, detail="Профиль продавца не найден")
        return profile
    except HTTPException:
        raise
    except Exception:
        logger.exception("get_public_seller failed code=%s", public_code)
        raise HTTPException(status_code=500, detail="Не удалось загрузить профиль")


@router.get("/public/buyers/{public_code}")
def get_public_buyer(public_code: str, db: Session = Depends(get_db)):
    try:
        profile = get_public_buyer_profile(db, public_code)
        if not profile:
            raise HTTPException(status_code=404, detail="Профиль покупателя не найден")
        return profile
    except HTTPException:
        raise
    except Exception:
        logger.exception("get_public_buyer failed code=%s", public_code)
        raise HTTPException(status_code=500, detail="Не удалось загрузить профиль")
