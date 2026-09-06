"""Admin API: MarzVPN Telegram users list + detail."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, inspect, select
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin_user
from app.db.database import get_db
from app.models.marzvpn import MarzVpnReferral, MarzVpnUser
from app.models.user import User

router = APIRouter(prefix="/admin/vpn", tags=["Admin VPN"])


class VpnUserListItem(BaseModel):
    telegram_id: int
    username: Optional[str] = None
    marzban_username: str
    created_at: Optional[datetime] = None
    expire_at: Optional[datetime] = None
    remaining_label: str
    is_active: bool
    referrals_count: int
    key_valid: bool = True


class VpnUserDetail(VpnUserListItem):
    subscription_url: Optional[str] = None
    crypt4_link: Optional[str] = None
    referrer_id: Optional[int] = None
    referrer_username: Optional[str] = None
    last_verified_at: Optional[datetime] = None
    verify_note: Optional[str] = None
    invited: list[dict[str, Any]] = []


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def format_remaining(expire_at: datetime | None, now: datetime | None = None) -> str:
    now = now or _utcnow()
    expire_at = _as_aware(expire_at)
    if expire_at is None:
        return "—"
    delta = expire_at - _as_aware(now)
    seconds = int(delta.total_seconds())
    if seconds <= 0:
        return "истекла"
    days, rem = divmod(seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes = rem // 60
    parts = []
    if days:
        parts.append(f"{days} дн.")
    if hours or days:
        parts.append(f"{hours} ч.")
    parts.append(f"{minutes} мин.")
    return " ".join(parts)


def _tables_ready(db: Session) -> bool:
    try:
        names = set(inspect(db.bind).get_table_names())
    except Exception:
        return False
    return "marzvpn_users" in names and "marzvpn_referrals" in names


def _referral_counts(db: Session) -> dict[int, int]:
    rows = db.execute(
        select(MarzVpnReferral.referrer_id, func.count(MarzVpnReferral.id)).group_by(
            MarzVpnReferral.referrer_id
        )
    ).all()
    return {int(r[0]): int(r[1]) for r in rows}


def _to_list_item(user: MarzVpnUser, referrals_count: int) -> VpnUserListItem:
    now = _utcnow()
    expire_at = _as_aware(user.expire_at)
    return VpnUserListItem(
        telegram_id=int(user.telegram_id),
        username=user.username,
        marzban_username=user.marzban_username,
        created_at=_as_aware(user.created_at),
        expire_at=expire_at,
        remaining_label=format_remaining(expire_at, now),
        is_active=bool(expire_at and expire_at > now),
        referrals_count=referrals_count,
        key_valid=bool(user.key_valid),
    )


@router.get("/users", response_model=list[VpnUserListItem])
def list_vpn_users(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    if not _tables_ready(db):
        return []
    counts = _referral_counts(db)
    users = db.execute(
        select(MarzVpnUser).order_by(MarzVpnUser.created_at.desc())
    ).scalars().all()
    return [_to_list_item(u, counts.get(int(u.telegram_id), 0)) for u in users]


@router.get("/users/{telegram_id}", response_model=VpnUserDetail)
def get_vpn_user(
    telegram_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    if not _tables_ready(db):
        raise HTTPException(status_code=404, detail="VPN tables not found")
    user = db.get(MarzVpnUser, telegram_id)
    if user is None:
        raise HTTPException(status_code=404, detail="VPN user not found")

    counts = _referral_counts(db)
    base = _to_list_item(user, counts.get(telegram_id, 0))

    referrer_username = None
    if user.referrer_id:
        ref = db.get(MarzVpnUser, int(user.referrer_id))
        if ref is not None:
            referrer_username = ref.username

    invited_rows = db.execute(
        select(MarzVpnReferral, MarzVpnUser)
        .join(MarzVpnUser, MarzVpnUser.telegram_id == MarzVpnReferral.referred_id)
        .where(MarzVpnReferral.referrer_id == telegram_id)
        .order_by(MarzVpnReferral.created_at.desc())
    ).all()
    invited = [
        {
            "telegram_id": int(ref_user.telegram_id),
            "username": ref_user.username,
            "created_at": _as_aware(referral.created_at),
            "reward_days": int(referral.reward_days),
            "expire_at": _as_aware(ref_user.expire_at),
            "remaining_label": format_remaining(ref_user.expire_at),
        }
        for referral, ref_user in invited_rows
    ]

    return VpnUserDetail(
        **base.model_dump(),
        subscription_url=user.subscription_url,
        crypt4_link=user.crypt4_link,
        referrer_id=int(user.referrer_id) if user.referrer_id else None,
        referrer_username=referrer_username,
        last_verified_at=_as_aware(user.last_verified_at),
        verify_note=user.verify_note,
        invited=invited,
    )
