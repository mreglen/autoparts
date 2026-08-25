from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import Optional, Tuple
from app.core.security import verify_password
from app.models.user import User
from app.models.user_session import UserSession
from app.db.database import get_db
from app.core.config import Settings
from app.utils.phone import normalize_to_storage_format
import hashlib
import secrets

settings = Settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def issue_auth_token_pair(
    db: Session,
    user: User,
    token_data: dict,
    device_info: str = None,
    ip_address: str = None,
    expires_delta: Optional[timedelta] = None,
) -> Tuple[str, str]:
    """Create UserSession and return (access_token, refresh_token)."""
    expires_delta = expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    session_token = secrets.token_hex(32)
    refresh_token = secrets.token_urlsafe(48)

    session = UserSession(
        user_id=user.id,
        session_token=session_token,
        refresh_token_hash=hash_refresh_token(refresh_token),
        refresh_expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        device_info=device_info,
        ip_address=ip_address,
        is_active=True,
    )
    db.add(session)
    db.commit()

    expire = datetime.utcnow() + expires_delta
    to_encode = {**token_data, "session_token": session_token, "exp": expire}
    access_token = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return access_token, refresh_token


def build_token_data_for_user(db: Session, user: User) -> dict:
    token_data = {"sub": user.email}
    if user.is_employee:
        from app.models.permission import Permission
        from app.models.user_permission import UserPermission

        user_permissions = db.query(UserPermission, Permission).join(
            Permission, UserPermission.permission_id == Permission.id
        ).filter(
            UserPermission.user_id == user.id
        ).all()
        token_data["user_permissions"] = [up.UserPermission.permission_id for up in user_permissions]
        token_data["permission_codes"] = [up.Permission.code for up in user_permissions]
    return token_data


def refresh_auth_tokens(db: Session, refresh_token: str) -> Tuple[str, str]:
    refresh_hash = hash_refresh_token(refresh_token)
    session = db.query(UserSession).filter(
        UserSession.refresh_token_hash == refresh_hash,
        UserSession.is_active == True,
    ).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh-токен недействителен",
        )

    if session.refresh_expires_at:
        expires_at = session.refresh_expires_at
        if expires_at.tzinfo is not None:
            expires_at = expires_at.replace(tzinfo=None)
        if expires_at < datetime.utcnow():
            session.is_active = False
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh-токен истёк",
            )

    user = db.query(User).filter(User.id == session.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден",
        )

    new_session_token = secrets.token_hex(32)
    new_refresh_token = secrets.token_urlsafe(48)
    session.session_token = new_session_token
    session.refresh_token_hash = hash_refresh_token(new_refresh_token)
    session.refresh_expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    session.last_activity = datetime.utcnow()
    db.commit()

    token_data = build_token_data_for_user(db, user)
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {**token_data, "session_token": new_session_token, "exp": expire}
    access_token = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return access_token, new_refresh_token


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
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:
        raise credentials_exception from exc
    email: str = payload.get("sub")
    session_token: str = payload.get("session_token")

    if email is None:
        raise credentials_exception

    user = get_user_by_email(db, email)
    if user is None:
        raise credentials_exception


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