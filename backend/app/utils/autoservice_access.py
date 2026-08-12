"""Shared access helpers for autoservice staff/public APIs."""
from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.organization import Organization
from app.models.autoservice_client import AutoserviceClient
from app.utils.org_access import resolve_autoservice_organization_id
from app.utils.phone import normalize_to_storage_format
from app.utils.site_settings_db import autoservice_enabled


def require_autoservice_enabled(db: Session) -> None:
    if not autoservice_enabled(db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Автосервис временно отключён",
        )


def require_autoservice_org_id(db: Session, user: User | None = None) -> str:
    if user and user.organization_id and not user.is_admin:
        org = db.query(Organization).filter(Organization.id == user.organization_id).first()
        if org and getattr(org, "is_autoservice", False):
            return org.id
    org_id = resolve_autoservice_organization_id(db)
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Организация автосервиса не настроена",
        )
    return org_id


def require_autoservice_staff(db: Session, user: User) -> str:
    require_autoservice_enabled(db)
    org_id = require_autoservice_org_id(db, user)
    if user.is_admin:
        return org_id
    if not user.organization_id or user.organization_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нет доступа к записям автосервиса",
        )
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org or not getattr(org, "is_autoservice", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Автосервис не подключён для вашей организации",
        )
    if not (user.is_director or user.is_seller or user.is_employee):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нет доступа к записям автосервиса",
        )
    return org_id


def require_autoservice_director(db: Session, user: User) -> str:
    org_id = require_autoservice_staff(db, user)
    if not user.is_director:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Настройки автосервиса доступны только директору",
        )
    return org_id


def normalize_phone_or_400(phone: str) -> str:
    normalized = normalize_to_storage_format(phone)
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный формат телефона",
        )
    return normalized


def user_display_name(user: User) -> str:
    parts = [user.last_name or "", user.first_name or "", user.patronymic or ""]
    name = " ".join(p for p in parts if p).strip()
    if name:
        return name[:120]
    if user.first_name:
        return user.first_name[:120]
    if user.email:
        return user.email.split("@")[0][:120]
    return f"Пользователь {user.id}"


def related_autoservice_client_ids(db: Session, client: AutoserviceClient) -> list[int]:
    """Same person may have several client rows (user_id / phone variants)."""
    ids = {client.id}
    org_id = client.organization_id
    if client.user_id is not None:
        for (cid,) in (
            db.query(AutoserviceClient.id)
            .filter(
                AutoserviceClient.organization_id == org_id,
                AutoserviceClient.user_id == client.user_id,
            )
            .all()
        ):
            ids.add(cid)
    phone = (client.phone or "").strip()
    if phone:
        for (cid,) in (
            db.query(AutoserviceClient.id)
            .filter(
                AutoserviceClient.organization_id == org_id,
                AutoserviceClient.phone == phone,
            )
            .all()
        ):
            ids.add(cid)
        digits = "".join(ch for ch in phone if ch.isdigit())
        if len(digits) >= 10:
            tail = digits[-10:]
            for row_id, row_phone in (
                db.query(AutoserviceClient.id, AutoserviceClient.phone)
                .filter(AutoserviceClient.organization_id == org_id)
                .all()
            ):
                row_digits = "".join(ch for ch in str(row_phone or "") if ch.isdigit())
                if row_digits.endswith(tail):
                    ids.add(row_id)
    return sorted(ids)


def find_active_autoservice_client_for_user(
    db: Session,
    user: User,
    org_id: str,
) -> AutoserviceClient | None:
    row = (
        db.query(AutoserviceClient)
        .filter(
            AutoserviceClient.organization_id == org_id,
            AutoserviceClient.user_id == user.id,
            AutoserviceClient.status == "active",
        )
        .first()
    )
    if row:
        return row
    if not user.phone:
        return None
    try:
        phone = normalize_phone_or_400(user.phone)
    except HTTPException:
        return None
    by_phone = (
        db.query(AutoserviceClient)
        .filter(
            AutoserviceClient.organization_id == org_id,
            AutoserviceClient.phone == phone,
            AutoserviceClient.status == "active",
        )
        .first()
    )
    if by_phone and (by_phone.user_id is None or by_phone.user_id == user.id):
        if by_phone.user_id is None:
            by_phone.user_id = user.id
            db.commit()
            db.refresh(by_phone)
        return by_phone
    return None


def require_my_active_autoservice_client(db: Session, user: User) -> AutoserviceClient:
    require_autoservice_enabled(db)
    org_id = require_autoservice_org_id(db)
    client = find_active_autoservice_client_for_user(db, user, org_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступно только клиентам автосервиса",
        )
    return client
