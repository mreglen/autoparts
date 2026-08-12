# app/routers/auth.py
from fastapi import APIRouter, Depends, Form, HTTPException, status, Request, Response, Query
from sqlalchemy.orm import Session, joinedload
from app.models.organization import Organization
from app.models.password_reset_token import PasswordResetToken
from app.models.pending_user import PendingUser
from app.models.pending_seller import PendingSeller
from app.models.user import User
from app.models.user_permission import UserPermission
from app.schemas.auth import (
    EmailOnly,
    PasswordResetConfirm,
    PasswordResetRequest,
    RegisterStep1,
    UserLogin,
    VerifyCode,
    Token,
    LoginResponse,
)
from app.schemas.pending_seller import SellerRegisterRequest, SellerRegisterResponse
from app.core.security import get_password_hash
from app.core.auth import authenticate_user, create_access_token, get_current_user, oauth2_scheme, cleanup_old_user_sessions
from app.models.user_session import UserSession
from app.db.database import get_db
from app.services.laximo.gate import laximo_cat_ready
from datetime import datetime, timedelta, timezone
from jose import jwt
from app.core.config import Settings
from app.schemas.user import UserResponse
from app.schemas.notification import NotificationPrefs
from app.services.notification_service import get_user_notification_prefs
from app.utils.email import generate_verification_code, send_verification_email, send_seller_application_confirmation, send_welcome_email
from app.utils.event_logger import log_event
from app.utils.id_generator import random_id
from app.utils.phone import normalize_to_storage_format  
from app.utils.guest_cart import merge_guest_cart_from_request
from app.utils.site_settings_db import get_or_create_site_settings
from app.utils.org_access import resolve_autoservice_organization_id
from app.utils.org_markup import (
    autoservice_markup_percent,
    buyer_markup_percent,
    global_markup_percent,
)
from app.utils.user_public_code import assign_public_code
from app.utils.user_avatar import avatar_public_url
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])
settings = Settings()


def build_user_profile_response(user: User) -> dict:
    return {
        "id": user.id,
        "public_code": user.public_code,
        "last_name": user.last_name,
        "first_name": user.first_name,
        "patronymic": user.patronymic,
        "email": user.email,
        "phone": user.phone,
        "avatar_url": avatar_public_url(user.avatar_url),
        "is_buyer": user.is_buyer,
        "is_seller": user.is_seller,
        "is_admin": user.is_admin,
        "is_director": user.is_director,
        "is_employee": user.is_employee,
        "organization_id": user.organization_id,
        "organization_name": user.organization.name if user.organization_id and user.organization else None,
        "organization_phone": user.organization.phone if user.organization_id and user.organization else None,
        "organization_is_autoservice": bool(
            getattr(user.organization, "is_autoservice", False)
            and not getattr(user.organization, "autoservice_paused", False)
        ) if user.organization_id and user.organization else False,
        "notification_prefs": NotificationPrefs.model_validate(
            get_user_notification_prefs(user)
        ).model_dump(),
    }


def _validate_and_normalize_phone(phone: str) -> str:
    """Вспомогательная функция: валидирует и нормализует телефон к формату +7 (XXX) XXX-XX-XX"""
    normalized = normalize_to_storage_format(phone)
    if not normalized:
        raise HTTPException(status_code=400, detail="Неверный формат телефона")
    return normalized


@router.post("/register/start")
def register_start(data: RegisterStep1, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")

    existing_pending = db.query(PendingUser).filter(PendingUser.email == data.email).first()
    if existing_pending:
        db.delete(existing_pending)
        db.commit()

    if data.is_seller:
        if not data.name_organization or not data.address_organization:
            raise HTTPException(status_code=400, detail="Для продавца обязательны название и адрес организации")

    try:
        normalized_phone = _validate_and_normalize_phone(data.phone)

        code = generate_verification_code()
        pending = PendingUser(
            last_name=data.last_name,
            first_name=data.first_name,
            patronymic=data.patronymic,
            email=data.email,
            phone=normalized_phone, 
            is_buyer=data.is_buyer,
            is_seller=data.is_seller,
            name_organization=data.name_organization,
            address_organization=data.address_organization,
            hashed_password=get_password_hash(data.password),
            verification_code=code,
        )
        db.add(pending)
        db.commit()
        db.refresh(pending)

        log_event(
            db,
            event_type="registration_started",
            email=pending.email,
            details={
                "is_buyer": pending.is_buyer,
                "is_seller": pending.is_seller,
                "phone": normalized_phone,
                "name_organization": pending.name_organization,
                "address_organization": pending.address_organization,
            }
        )

        send_verification_email(data.email, code)
        return {"msg": "Код подтверждения отправлен на ваш email"}

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        logger.exception("Ошибка при сохранении или отправке email")
        db.rollback()
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/register/confirm")
def register_confirm(data: VerifyCode, request: Request, response: Response, db: Session = Depends(get_db)):
    pending = db.query(PendingUser).filter(PendingUser.email == data.email).first()
    if not pending:
        raise HTTPException(status_code=400, detail="Нет данных для этого email")

    now = datetime.now(timezone.utc)
    if (now - pending.created_at).total_seconds() > settings.VERIFICATION_CODE_EXPIRE_SECONDS:
        db.delete(pending)
        db.commit()
        raise HTTPException(status_code=400, detail="Код устарел")

    if pending.verification_code != data.code:
        raise HTTPException(status_code=400, detail="Неверный код")

    organization_id = None

    if pending.is_seller:
        from app.utils.id_generator import random_id
        org_id = random_id(10)
        org = Organization(
            id=org_id,
            name=pending.name_organization,
            address=pending.address_organization
        )
        db.add(org)
        db.flush()
        organization_id = org.id

    user = User(
        last_name=pending.last_name,
        first_name=pending.first_name,
        patronymic=pending.patronymic,
        email=pending.email,
        phone=pending.phone,  
        is_buyer=pending.is_buyer,
        is_seller=pending.is_seller,
        organization_id=organization_id,
        hashed_password=pending.hashed_password,
        is_director=pending.is_seller,
    )
    assign_public_code(user, db)
    db.add(user)
    db.delete(pending)
    db.commit()
    db.refresh(user)
    
    if user.organization_id:
        from app.services.organization_chat_service import on_user_joined_organization
        on_user_joined_organization(db, user)
    if user.is_seller:
        from app.services.organization_chat_service import on_user_became_seller
        on_user_became_seller(db, user)
    if user.organization_id or user.is_seller:
        db.commit()

    # Refresh user with organization data
    user_with_org = db.query(User).options(joinedload(User.organization)).filter(User.id == user.id).first()
    
    log_event(
        db,
        event_type="user_registered",
        user_id=user.id,
        email=user.email,
        details={
            "is_buyer": user.is_buyer,
            "is_seller": user.is_seller,
            "phone": user.phone,
            "public_code": user.public_code,
        }
    )

    # Send welcome email to user
    full_name = f"{user.first_name} {user.last_name}".strip()
    if user.patronymic:
        full_name += f" {user.patronymic}"
    
    organization_name = None
    if user_with_org and user_with_org.organization:
        organization_name = user_with_org.organization.name
    
    send_welcome_email(
        email=user.email,
        full_name=full_name,
        login=user.email,
        password=pending.password,  # Send the original password
        organization_name=organization_name
    )

    # Создаем токен с сессией
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=access_token_expires,
        db=db,
        user=user,
        device_info="Registration",
        ip_address=None
    )
    
    # Clean up old sessions for this user (IP is None during registration)
    merge_guest_cart_from_request(db, request, response, user.id)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login", response_model=LoginResponse)
def login(
    username: str = Form(...),
    password: str = Form(...),
    user_agent: str = Form(None, description="User agent браузера"),
    device_info: str = Form(None, description="Информация об устройстве"),
    db: Session = Depends(get_db),
    request: Request = None,
    response: Response = None
):
    user = authenticate_user(db, username, password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email/телефон или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = (
        db.query(User)
        .options(joinedload(User.organization))
        .filter(User.id == user.id)
        .first()
    )

    # Получаем IP адрес
    ip_address = request.client.host if request else None

    # Информация об устройстве
    if not device_info and user_agent:
        device_info = user_agent[:255]  # Ограничиваем длину

    log_event(db, event_type="user_logged_in", user_id=user.id, email=user.email, details={
        "ip_address": ip_address,
        "device_info": device_info
    })

    # Формируем данные для токена
    token_data = {"sub": user.email}
    
    # Если пользователь является сотрудником, добавляем права доступа в токен
    if user.is_employee:
        from app.models.permission import Permission
        user_permissions = db.query(UserPermission, Permission).join(
            Permission, UserPermission.permission_id == Permission.id
        ).filter(
            UserPermission.user_id == user.id
        ).all()
        # Store both permission IDs and codes for easy checking
        token_data["user_permissions"] = [up.UserPermission.permission_id for up in user_permissions]
        token_data["permission_codes"] = [up.Permission.code for up in user_permissions]

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data=token_data,
        expires_delta=access_token_expires,
        db=db,
        user=user,
        device_info=device_info,
        ip_address=ip_address
    )
    
    # Clean up old sessions for this user from the same IP
    if ip_address:
        cleanup_old_user_sessions(db, user.id, ip_address)

    if request is not None and response is not None:
        merge_guest_cart_from_request(db, request, response, user.id)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": build_user_profile_response(user),
    }

@router.get("/profile", response_model=UserResponse)
def get_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_data = (
        db.query(User)
        .options(joinedload(User.organization))
        .filter(User.id == current_user.id)
        .first()
    )
    return build_user_profile_response(user_data)

@router.post("/register/send-code")
def send_code(data: EmailOnly, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")


    existing = db.query(PendingUser).filter(PendingUser.email == email).first()
    if existing:
        db.delete(existing)
        db.commit()

    code = generate_verification_code()
    pending = PendingUser(
        email=email,
        verification_code=code,
        created_at=datetime.now(timezone.utc)
    )
    db.add(pending)
    db.commit()
    send_verification_email(email, code)
    return {"msg": "Код отправлен"}


@router.post("/register/verify-code")
def verify_code(data: VerifyCode, db: Session = Depends(get_db)):
    pending = db.query(PendingUser).filter(PendingUser.email == data.email).first()
    if not pending:
        raise HTTPException(status_code=400, detail="Нет данных для этого email")

    if pending.verification_code != data.code:
        raise HTTPException(status_code=400, detail="Неверный код")

    pending.is_verified = True
    db.commit()

    return {"msg": "Код подтверждён"}


@router.post("/register/complete")
def complete_registration(data: RegisterStep1, db: Session = Depends(get_db), request: Request = None, response: Response = None):
    pending = db.query(PendingUser).filter(PendingUser.email == data.email).first()
    if not pending or not pending.is_verified:
        raise HTTPException(status_code=400, detail="Email не подтверждён")

    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")

    if data.is_seller:
        if not data.name_organization or not data.address_organization:
            raise HTTPException(status_code=400, detail="Для продавца обязательны название и адрес организации")

    try:
        normalized_phone = _validate_and_normalize_phone(data.phone)

        organization_id = None
        if data.is_seller:
            org_id = random_id(10)
            org = Organization(
                id=org_id,
                name=data.name_organization,
                address=data.address_organization
            )
            db.add(org)
            db.flush()
            organization_id = org.id

        user = User(
            last_name=data.last_name,
            first_name=data.first_name,
            patronymic=data.patronymic,
            email=data.email,
            phone=normalized_phone,  
            is_buyer=data.is_buyer,
            is_seller=data.is_seller,
            organization_id=organization_id,
            hashed_password=get_password_hash(data.password),
            is_director=data.is_seller, 
        )
        assign_public_code(user, db)
        db.add(user)
        db.delete(pending)
        db.commit()
        db.refresh(user)

        if user.organization_id:
            from app.services.organization_chat_service import on_user_joined_organization
            on_user_joined_organization(db, user)
        if user.is_seller:
            from app.services.organization_chat_service import on_user_became_seller
            on_user_became_seller(db, user)
        if user.organization_id or user.is_seller:
            db.commit()

        # Refresh user with organization data
        user_with_org = db.query(User).options(joinedload(User.organization)).filter(User.id == user.id).first()
        
        log_event(
            db,
            event_type="user_registered",
            user_id=user.id,
            email=user.email,
            details={
                "is_buyer": user.is_buyer,
                "is_seller": user.is_seller,
                "public_code": user.public_code,
                "phone": user.phone,
            }
        )

        # Send welcome email to user
        full_name = f"{user.first_name} {user.last_name}".strip()
        if user.patronymic:
            full_name += f" {user.patronymic}"
        
        organization_name = None
        if user_with_org and user_with_org.organization:
            organization_name = user_with_org.organization.name
        
        send_welcome_email(
            email=user.email,
            full_name=full_name,
            login=user.email,
            password=data.password,  # Send the original password
            organization_name=organization_name
        )

        # Создаем токен с сессией
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email},
            expires_delta=access_token_expires,
            db=db,
            user=user,
            device_info="Registration Complete",
            ip_address=request.client.host if request else None
        )
        
        # Clean up old sessions for this user from the same IP
        ip_address = request.client.host if request else None
        if ip_address:
            cleanup_old_user_sessions(db, user.id, ip_address)

        if request is not None and response is not None:
            merge_guest_cart_from_request(db, request, response, user.id)
        return {"access_token": access_token, "token_type": "bearer"}

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        logger.exception("Ошибка при создании пользователя")
        db.rollback()
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/logout")
def logout(
    current_user: User = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    try:
        # Декодируем токен, чтобы получить session_token
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        session_token = payload.get("session_token")

        if session_token:
            # Деактивируем сессию в базе данных
            session = db.query(UserSession).filter(
                UserSession.user_id == current_user.id,
                UserSession.session_token == session_token
            ).first()

            if session:
                session.is_active = False
                db.commit()

        log_event(db, event_type="user_logged_out", user_id=current_user.id, email=current_user.email)
        return {"msg": "Выход выполнен"}

    except Exception as e:
        # Даже если что-то пошло не так, возвращаем успешный ответ
        # чтобы не раскрывать детали внутренней работы
        return {"msg": "Выход выполнен"}


@router.post("/password/send-code")
def send_password_reset_code(data: PasswordResetRequest, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Пользователь с таким email не найден")

    db.query(PasswordResetToken).filter(PasswordResetToken.email == email).delete()
    db.commit()

    token = generate_verification_code()
    reset_token = PasswordResetToken(token=token, email=email)
    db.add(reset_token)
    db.commit()
    send_verification_email(email, token)
    return {"msg": "Код подтверждения отправлен на ваш email"}


@router.post("/seller/register", response_model=SellerRegisterResponse)
def seller_register(data: SellerRegisterRequest, db: Session = Depends(get_db)):
    # Check if email already exists in users or pending sellers
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
    
    if db.query(PendingSeller).filter(PendingSeller.email == data.email).first():
        raise HTTPException(status_code=400, detail="Заявка с таким email уже существует")

    pending_user = db.query(PendingUser).filter(PendingUser.email == data.email.lower()).first()
    if not pending_user or not pending_user.is_verified:
        raise HTTPException(status_code=400, detail="Email не подтверждён")

    try:
        # Validate and normalize phone
        normalized_phone = _validate_and_normalize_phone(data.phone)
        
        # Create pending seller record
        pending_seller = PendingSeller(
            last_name=data.last_name,
            first_name=data.first_name,
            patronymic=data.patronymic,
            name_organization=data.name_organization,
            description_organization=data.description_organization,
            address_organization=data.address_organization,
            phone=normalized_phone,
            email=data.email.lower()
        )
        
        db.add(pending_seller)
        db.commit()
        db.refresh(pending_seller)
        
        log_event(
            db,
            event_type="seller_registration_submitted",
            email=pending_seller.email,
            details={
                "last_name": pending_seller.last_name,
                "first_name": pending_seller.first_name,
                "patronymic": pending_seller.patronymic,
                "name_organization": pending_seller.name_organization,
                "phone": normalized_phone,
            }
        )
        
        # Send confirmation email to seller
        full_name = f"{pending_seller.first_name} {pending_seller.last_name}".strip()
        if pending_seller.patronymic:
            full_name += f" {pending_seller.patronymic}"
            
        send_seller_application_confirmation(
            email=pending_seller.email,
            full_name=full_name,
            organization_name=pending_seller.name_organization
        )
        
        return SellerRegisterResponse(msg="Заявка успешно отправлена. Ожидайте модерации. Подтверждение отправлено на ваш email.")

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        logger.exception("Ошибка при регистрации продавца")
        db.rollback()
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/password/verify")
def verify_password_reset(data: PasswordResetConfirm, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    code = data.code.strip()

    token_record = db.query(PasswordResetToken).filter(
        PasswordResetToken.email == email,
        PasswordResetToken.token == code
    ).first()

    if not token_record:
        raise HTTPException(status_code=400, detail="Неверный код или email")

    now = datetime.now(timezone.utc)
    if (now - token_record.created_at).total_seconds() > settings.VERIFICATION_CODE_EXPIRE_SECONDS:
        db.delete(token_record)
        db.commit()
        raise HTTPException(status_code=400, detail="Код устарел")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Пользователь не найден")

    user.hashed_password = get_password_hash(data.new_password)
    db.delete(token_record)
    db.commit()
    return {"msg": "Пароль успешно изменён"}


@router.get("/admin-organization-phone")
def get_admin_organization_phone(db: Session = Depends(get_db)):
    """Get the phone number of the admin organization for public display"""
    # Find the admin user (is_admin = True)
    admin_user = db.query(User).filter(User.is_admin == True).first()
    
    if not admin_user or not admin_user.organization_id:
        raise HTTPException(status_code=404, detail="Admin organization not found")
    
    # Get the organization
    organization = db.query(Organization).filter(Organization.id == admin_user.organization_id).first()
    
    if not organization or not organization.phone:
        raise HTTPException(status_code=404, detail="Organization phone not found")
    
    return {
        "organization_name": organization.name,
        "organization_phone": organization.phone
    }


@router.get("/public-site-config")
def get_public_site_config(
    organization_id: str | None = Query(None, description="Deprecated, ignored: публичная наценка всегда buyer markup"),
    db: Session = Depends(get_db),
):
    """Публичная конфигурация: телефон админ-организации (если есть), флаг «новые запчасти», наценки на новые %. Всегда 200."""
    settings_row = get_or_create_site_settings(db)
    org_name = None
    org_phone = None
    admin_user = db.query(User).filter(User.is_admin == True).first()
    if admin_user and admin_user.organization_id:
        organization = db.query(Organization).filter(Organization.id == admin_user.organization_id).first()
        if organization:
            org_name = organization.name
            org_phone = organization.phone
    purchase_mode = getattr(settings_row, "used_parts_purchase_mode", None) or "both"
    if purchase_mode not in ("cart_only", "cta_only", "both"):
        purchase_mode = "both"

    return {
        "organization_name": org_name,
        "organization_phone": org_phone,
        "show_new_autoparts": settings_row.show_new_autoparts,
        "show_site_reviews": getattr(settings_row, "show_site_reviews", True) is not False,
        "show_yandex_badge": getattr(settings_row, "show_yandex_badge", True) is not False,
        "show_warehouse_inventory": getattr(settings_row, "show_warehouse_inventory", False) is True,
        "show_autoservice": getattr(settings_row, "show_autoservice", False) is True,
        "autoservice_organization_id": resolve_autoservice_organization_id(db),
        "new_parts_markup_percent": buyer_markup_percent(settings_row),
        "seller_markup_percent": global_markup_percent(settings_row),
        "autoservice_markup_percent": autoservice_markup_percent(settings_row),
        "used_parts_purchase_mode": purchase_mode,
        "round_product_prices": getattr(settings_row, "round_product_prices", False) is True,
        "laximo_vin_catalog_available": laximo_cat_ready(db),
    }