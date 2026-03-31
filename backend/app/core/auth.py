from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import Optional
from app.core.security import verify_password
from app.models.user import User
from app.models.user_session import UserSession
from app.db.database import get_db
from app.core.config import Settings
from app.utils.phone import normalize_to_storage_format
import secrets

settings = Settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None, db: Session = None, user: User = None, device_info: str = None, ip_address: str = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=30))
    to_encode.update({"exp": expire})

    token = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


    if db and user:
        session_token = secrets.token_hex(32)


        session = UserSession(
            user_id=user.id,
            session_token=session_token,
            device_info=device_info,
            ip_address=ip_address,
            is_active=True
        )
        db.add(session)
        db.commit()


        to_encode.update({"session_token": session_token})
        token = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    return token

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()

def authenticate_user(db: Session, login: str, password: str):
    login = login.strip()

    if '@' in login and '.' in login:
        user = db.query(User).filter(User.email.ilike(login)).first()
    else:
        normalized = normalize_to_storage_format(login)
        if not normalized:
            return False
        user = db.query(User).filter(User.phone == normalized).first()

    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    email: str = payload.get("sub")
    session_token: str = payload.get("session_token")

    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Не удалось проверить учетные данные",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_user_by_email(db, email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Не удалось проверить учетные данные",
            headers={"WWW-Authenticate": "Bearer"},
        )


    if session_token:
        session = db.query(UserSession).filter(
            UserSession.user_id == user.id,
            UserSession.session_token == session_token,
            UserSession.is_active == True
        ).first()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Сессия истекла или недействительна",
                headers={"WWW-Authenticate": "Bearer"},
            )


        session.last_activity = datetime.utcnow()
        db.commit()

    return user


def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db)
) -> Optional[User]:
    if not token:
        return None
    try:
        return get_current_user(token=token, db=db)
    except Exception:
        return None

def get_current_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещён: требуется роль администратора"
        )
    return current_user

def cleanup_old_user_sessions(db: Session, user_id: int, ip_address: str, max_sessions_per_ip: int = 5):
    from sqlalchemy import and_
    old_sessions = db.query(UserSession)\
        .filter(and_(UserSession.user_id == user_id, UserSession.ip_address == ip_address))\
        .order_by(UserSession.created_at.desc())\
        .offset(max_sessions_per_ip)\
        .all()

    for session in old_sessions:
        db.delete(session)

    db.commit()
    
    return len(old_sessions)


def cleanup_expired_sessions(db: Session, hours_threshold: int = 24):
    from datetime import datetime, timedelta
    
    threshold_time = datetime.utcnow() - timedelta(hours=hours_threshold)
    expired_sessions = db.query(UserSession)\
        .filter(UserSession.last_activity < threshold_time)\
        .all()

    for session in expired_sessions:
        db.delete(session)

    db.commit()
    
    return len(expired_sessions)