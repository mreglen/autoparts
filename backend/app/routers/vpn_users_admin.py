"""Admin API: MarzVPN users — list, detail, actions, payments, Marzban live stats."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, inspect, select
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin_user
from app.db.database import get_db
from app.models.marzvpn import MarzVpnPayment, MarzVpnReferral, MarzVpnUser
from app.models.user import User
from app.services.marzban_client import (
    MarzbanSyncClient,
    build_happ_add_link,
    public_subscription_url,
    try_get_marzban_summary,
)

router = APIRouter(prefix="/admin/vpn", tags=["Admin VPN"])

PaymentStatus = Literal["pending", "paid", "failed", "refunded", "cancelled"]


class VpnUserListItem(BaseModel):
    telegram_id: int
    username: Optional[str] = None
    marzban_username: str
    created_at: Optional[datetime] = None
    expire_at: Optional[datetime] = None
    remaining_label: str
    is_active: bool
    account_status: str = "active"
    referrals_count: int
    key_valid: bool = True
    payments_paid_count: int = 0


class VpnPaymentOut(BaseModel):
    id: int
    telegram_id: int
    amount_rub: float
    days_granted: int
    status: str
    provider: Optional[str] = None
    external_id: Optional[str] = None
    note: Optional[str] = None
    created_by_admin_id: Optional[int] = None
    created_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None


class VpnUserDetail(VpnUserListItem):
    subscription_url: Optional[str] = None
    crypt4_link: Optional[str] = None
    referrer_id: Optional[int] = None
    referrer_username: Optional[str] = None
    last_verified_at: Optional[datetime] = None
    verify_note: Optional[str] = None
    invited: list[dict[str, Any]] = []
    marzban: dict[str, Any] = {}
    payments: list[VpnPaymentOut] = []


class DaysBody(BaseModel):
    days: int = Field(..., ge=1, le=3650)


class PaymentCreateBody(BaseModel):
    amount_rub: float = Field(0, ge=0)
    days_granted: int = Field(0, ge=0, le=3650)
    status: PaymentStatus = "paid"
    provider: Optional[str] = "manual"
    external_id: Optional[str] = None
    note: Optional[str] = None
    apply_days: bool = True


class PaymentPatchBody(BaseModel):
    status: PaymentStatus
    note: Optional[str] = None


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
    seconds = int((expire_at - _as_aware(now)).total_seconds())
    if seconds <= 0:
        return "истекла"
    days, rem = divmod(seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes = rem // 60
    parts: list[str] = []
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


def _payments_ready(db: Session) -> bool:
    try:
        names = set(inspect(db.bind).get_table_names())
    except Exception:
        return False
    return "marzvpn_payments" in names


def _account_status(user: MarzVpnUser) -> str:
    return str(getattr(user, "account_status", None) or "active")


def _referral_counts(db: Session) -> dict[int, int]:
    rows = db.execute(
        select(MarzVpnReferral.referrer_id, func.count(MarzVpnReferral.id)).group_by(
            MarzVpnReferral.referrer_id
        )
    ).all()
    return {int(r[0]): int(r[1]) for r in rows}


def _paid_payment_counts(db: Session) -> dict[int, int]:
    if not _payments_ready(db):
        return {}
    rows = db.execute(
        select(MarzVpnPayment.telegram_id, func.count(MarzVpnPayment.id))
        .where(MarzVpnPayment.status == "paid")
        .group_by(MarzVpnPayment.telegram_id)
    ).all()
    return {int(r[0]): int(r[1]) for r in rows}


def _payment_out(row: MarzVpnPayment) -> VpnPaymentOut:
    return VpnPaymentOut(
        id=int(row.id),
        telegram_id=int(row.telegram_id),
        amount_rub=float(row.amount_rub or 0),
        days_granted=int(row.days_granted or 0),
        status=str(row.status),
        provider=row.provider,
        external_id=row.external_id,
        note=row.note,
        created_by_admin_id=row.created_by_admin_id,
        created_at=_as_aware(row.created_at),
        paid_at=_as_aware(row.paid_at),
    )


def _to_list_item(
    user: MarzVpnUser,
    referrals_count: int,
    payments_paid_count: int = 0,
) -> VpnUserListItem:
    now = _utcnow()
    expire_at = _as_aware(user.expire_at)
    status = _account_status(user)
    return VpnUserListItem(
        telegram_id=int(user.telegram_id),
        username=user.username,
        marzban_username=user.marzban_username,
        created_at=_as_aware(user.created_at),
        expire_at=expire_at,
        remaining_label=format_remaining(expire_at, now),
        is_active=bool(expire_at and expire_at > now and status == "active"),
        account_status=status,
        referrals_count=referrals_count,
        key_valid=bool(user.key_valid),
        payments_paid_count=payments_paid_count,
    )


def _get_user_or_404(db: Session, telegram_id: int) -> MarzVpnUser:
    if not _tables_ready(db):
        raise HTTPException(status_code=404, detail="VPN tables not found")
    user = db.get(MarzVpnUser, telegram_id)
    if user is None:
        raise HTTPException(status_code=404, detail="VPN user not found")
    return user


def _extend_user_days(user: MarzVpnUser, days: int) -> datetime:
    now = _utcnow()
    base = _as_aware(user.expire_at) or now
    if base < now:
        base = now
    user.expire_at = base + timedelta(days=int(days))
    return _as_aware(user.expire_at)  # type: ignore[return-value]


def _sync_active(user: MarzVpnUser) -> None:
    with MarzbanSyncClient() as client:
        client.activate_user(
            user.marzban_username,
            expire_at=_as_aware(user.expire_at) or _utcnow(),
        )


def _sync_disabled(user: MarzVpnUser) -> None:
    with MarzbanSyncClient() as client:
        client.disable_user(user.marzban_username)


def _build_detail(db: Session, user: MarzVpnUser) -> VpnUserDetail:
    counts = _referral_counts(db)
    paid_counts = _paid_payment_counts(db)
    tid = int(user.telegram_id)
    base = _to_list_item(user, counts.get(tid, 0), paid_counts.get(tid, 0))

    referrer_username = None
    if user.referrer_id:
        ref = db.get(MarzVpnUser, int(user.referrer_id))
        if ref is not None:
            referrer_username = ref.username

    invited_rows = db.execute(
        select(MarzVpnReferral, MarzVpnUser)
        .join(MarzVpnUser, MarzVpnUser.telegram_id == MarzVpnReferral.referred_id)
        .where(MarzVpnReferral.referrer_id == tid)
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

    payments: list[VpnPaymentOut] = []
    if _payments_ready(db):
        rows = (
            db.execute(
                select(MarzVpnPayment)
                .where(MarzVpnPayment.telegram_id == tid)
                .order_by(MarzVpnPayment.created_at.desc())
                .limit(50)
            )
            .scalars()
            .all()
        )
        payments = [_payment_out(r) for r in rows]

    return VpnUserDetail(
        **base.model_dump(),
        subscription_url=user.subscription_url,
        crypt4_link=user.crypt4_link,
        referrer_id=int(user.referrer_id) if user.referrer_id else None,
        referrer_username=referrer_username,
        last_verified_at=_as_aware(user.last_verified_at),
        verify_note=user.verify_note,
        invited=invited,
        marzban=try_get_marzban_summary(user.marzban_username),
        payments=payments,
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
    paid_counts = _paid_payment_counts(db)
    users = (
        db.execute(select(MarzVpnUser).order_by(MarzVpnUser.created_at.desc()))
        .scalars()
        .all()
    )
    return [
        _to_list_item(
            u,
            counts.get(int(u.telegram_id), 0),
            paid_counts.get(int(u.telegram_id), 0),
        )
        for u in users
    ]


@router.get("/users/{telegram_id}", response_model=VpnUserDetail)
def get_vpn_user(
    telegram_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    return _build_detail(db, _get_user_or_404(db, telegram_id))


@router.post("/users/{telegram_id}/extend", response_model=VpnUserDetail)
def extend_vpn_user(
    telegram_id: int,
    body: DaysBody,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    user = _get_user_or_404(db, telegram_id)
    if _account_status(user) == "banned":
        raise HTTPException(status_code=400, detail="Сначала снимите бан")
    _extend_user_days(user, body.days)
    user.account_status = "active"
    try:
        _sync_active(user)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=502, detail=f"Marzban: {exc}") from exc
    db.commit()
    db.refresh(user)
    return _build_detail(db, user)


@router.post("/users/{telegram_id}/disable", response_model=VpnUserDetail)
def disable_vpn_user(
    telegram_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    user = _get_user_or_404(db, telegram_id)
    if _account_status(user) == "banned":
        raise HTTPException(status_code=400, detail="Пользователь в бане")
    user.account_status = "disabled"
    try:
        _sync_disabled(user)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=502, detail=f"Marzban: {exc}") from exc
    db.commit()
    db.refresh(user)
    return _build_detail(db, user)


@router.post("/users/{telegram_id}/enable", response_model=VpnUserDetail)
def enable_vpn_user(
    telegram_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    user = _get_user_or_404(db, telegram_id)
    if _account_status(user) == "banned":
        raise HTTPException(status_code=400, detail="Сначала снимите бан")
    now = _utcnow()
    expire_at = _as_aware(user.expire_at)
    if expire_at is None or expire_at <= now:
        raise HTTPException(
            status_code=400,
            detail="Подписка истекла — сначала выдайте дни",
        )
    user.account_status = "active"
    try:
        _sync_active(user)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=502, detail=f"Marzban: {exc}") from exc
    db.commit()
    db.refresh(user)
    return _build_detail(db, user)


@router.post("/users/{telegram_id}/ban", response_model=VpnUserDetail)
def ban_vpn_user(
    telegram_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    user = _get_user_or_404(db, telegram_id)
    user.account_status = "banned"
    try:
        _sync_disabled(user)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=502, detail=f"Marzban: {exc}") from exc
    db.commit()
    db.refresh(user)
    return _build_detail(db, user)


@router.post("/users/{telegram_id}/unban", response_model=VpnUserDetail)
def unban_vpn_user(
    telegram_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    user = _get_user_or_404(db, telegram_id)
    now = _utcnow()
    expire_at = _as_aware(user.expire_at)
    if expire_at and expire_at > now:
        user.account_status = "active"
        try:
            _sync_active(user)
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=502, detail=f"Marzban: {exc}") from exc
    else:
        user.account_status = "disabled"
        try:
            _sync_disabled(user)
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=502, detail=f"Marzban: {exc}") from exc
    db.commit()
    db.refresh(user)
    return _build_detail(db, user)


@router.post("/users/{telegram_id}/reset-key", response_model=VpnUserDetail)
def reset_vpn_key(
    telegram_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    user = _get_user_or_404(db, telegram_id)
    try:
        with MarzbanSyncClient() as client:
            payload = client.revoke_sub(user.marzban_username)
            raw = payload.get("subscription_url")
            sub = public_subscription_url(raw) if isinstance(raw, str) else None
            if not sub:
                raise RuntimeError("Marzban не вернул subscription_url после revoke")
            user.subscription_url = sub
            user.crypt4_link = build_happ_add_link(sub)
            user.key_valid = True
            user.verify_note = "admin_reset_key"
            user.last_verified_at = _utcnow()
            if _account_status(user) == "active":
                expire_at = _as_aware(user.expire_at)
                if expire_at and expire_at > _utcnow():
                    client.activate_user(user.marzban_username, expire_at=expire_at)
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=502, detail=f"Marzban: {exc}") from exc
    db.commit()
    db.refresh(user)
    return _build_detail(db, user)


@router.post("/users/{telegram_id}/reset-traffic", response_model=VpnUserDetail)
def reset_vpn_traffic(
    telegram_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    user = _get_user_or_404(db, telegram_id)
    try:
        with MarzbanSyncClient() as client:
            client.reset_traffic(user.marzban_username)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Marzban: {exc}") from exc
    return _build_detail(db, user)


@router.get("/users/{telegram_id}/payments", response_model=list[VpnPaymentOut])
def list_vpn_payments(
    telegram_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    _get_user_or_404(db, telegram_id)
    if not _payments_ready(db):
        return []
    rows = (
        db.execute(
            select(MarzVpnPayment)
            .where(MarzVpnPayment.telegram_id == telegram_id)
            .order_by(MarzVpnPayment.created_at.desc())
        )
        .scalars()
        .all()
    )
    return [_payment_out(r) for r in rows]


@router.post("/users/{telegram_id}/payments", response_model=VpnUserDetail)
def create_vpn_payment(
    telegram_id: int,
    body: PaymentCreateBody,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    user = _get_user_or_404(db, telegram_id)
    if not _payments_ready(db):
        raise HTTPException(status_code=503, detail="Таблица платежей ещё не создана")

    paid_at = _utcnow() if body.status == "paid" else None
    row = MarzVpnPayment(
        telegram_id=telegram_id,
        amount_rub=Decimal(str(round(body.amount_rub, 2))),
        days_granted=int(body.days_granted),
        status=body.status,
        provider=(body.provider or "manual")[:64],
        external_id=(body.external_id or None),
        note=body.note,
        created_by_admin_id=getattr(current_user, "id", None),
        paid_at=paid_at,
    )
    db.add(row)

    if (
        body.status == "paid"
        and body.apply_days
        and body.days_granted > 0
        and _account_status(user) != "banned"
    ):
        _extend_user_days(user, body.days_granted)
        user.account_status = "active"
        try:
            _sync_active(user)
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=502, detail=f"Marzban: {exc}") from exc

    db.commit()
    db.refresh(user)
    return _build_detail(db, user)


@router.patch("/payments/{payment_id}", response_model=VpnPaymentOut)
def patch_vpn_payment(
    payment_id: int,
    body: PaymentPatchBody,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    if not _payments_ready(db):
        raise HTTPException(status_code=404, detail="Payment not found")
    row = db.get(MarzVpnPayment, payment_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    prev = str(row.status)
    row.status = body.status
    if body.note is not None:
        row.note = body.note
    if body.status == "paid" and prev != "paid":
        row.paid_at = _utcnow()
    if body.status in ("pending", "cancelled", "failed"):
        row.paid_at = None
    db.commit()
    db.refresh(row)
    return _payment_out(row)
