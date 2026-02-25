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

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None, db: Session = None, user: User = None, device_info: str = None, ip_address: str = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=30))
    to_encode.update({"exp": expire})

    # Создаем JWT токен
    token = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    # Если переданы параметры для создания сессии, создаем её в БД
    if db and user:
        # Генерируем уникальный идентификатор сессии
        session_token = secrets.token_hex(32)

        # Создаем новую сессию
        session = UserSession(
            user_id=user.id,
            session_token=session_token,
            device_info=device_info,
            ip_address=ip_address,
            is_active=True
        )
        db.add(session)
        db.commit()

        # Добавляем session_token в payload токена
        to_encode.update({"session_token": session_token})
        token = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    return token

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()

def authenticate_user(db: Session, login: str, password: str):
    login = login.strip()

    if '@' in login and '.' in login:
        # Это email — ищем без учета регистра
        user = db.query(User).filter(User.email.ilike(login)).first()
    else:
        # Это телефон — нормализуем к формату хранения
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
        email: str = payload.get("sub")
        session_token: str = payload.get("session_token")

        if email is None:
            raise credentials_exception
    except Exception:
        raise credentials_exception

    user = get_user_by_email(db, email)
    if user is None:
        raise credentials_exception

    # Если в токене есть session_token, проверяем валидность сессии
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

        # Обновляем время последней активности
        session.last_activity = datetime.utcnow()
        db.commit()

    return user

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
    """
    Удаляет старые сессии для конкретного пользователя с одного и того же IP-адреса.
    Оставляет только последние max_sessions_per_ip сессий.
    
    Args:
        db: Database session
        user_id: ID пользователя
        ip_address: IP-адрес, для которого нужно очистить сессии
        max_sessions_per_ip: Максимальное количество сессий, которые можно оставить для одного IP (по умолчанию 5)
    """
    from sqlalchemy import and_
    
    # Получаем старые сессии для конкретного пользователя с указанного IP
    old_sessions = db.query(UserSession)\
        .filter(and_(UserSession.user_id == user_id, UserSession.ip_address == ip_address))\
        .order_by(UserSession.created_at.desc())\
        .offset(max_sessions_per_ip)\
        .all()
    
    # Удаляем старые сессии
    for session in old_sessions:
        db.delete(session)

    db.commit()
    
    return len(old_sessions)  # Возвращаем количество удаленных сессий


def cleanup_expired_sessions(db: Session, hours_threshold: int = 24):
    """
    Удаляет просроченные сессии, которые не были активны указанное количество часов.
    
    Args:
        db: Database session
        hours_threshold: Количество часов, после которых сессия считается просроченной
    """
    from datetime import datetime, timedelta
    
    threshold_time = datetime.utcnow() - timedelta(hours=hours_threshold)
    expired_sessions = db.query(UserSession)\
        .filter(UserSession.last_activity < threshold_time)\
        .all()

    for session in expired_sessions:
        db.delete(session)

    db.commit()
    
    return len(expired_sessions)  # Возвращаем количество удаленных сессий