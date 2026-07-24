from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.auth import get_current_admin_user
from app.db.database import get_db
from app.models.site_payment import SitePayment, SitePaymentLedger
from app.models.user import User
from app.schemas.site_payment import (
    SitePaymentCreate,
    SitePaymentPay,
    SitePaymentUpdate,
    SitePaymentView,
)
from app.services.audit_service import log_audit

router = APIRouter(prefix="/admin/site-payments", tags=["Admin site payments"])

ACTIVE_STATUSES = ("active", "paused")
TWOPLACES = Decimal("0.01")


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def _remaining(payment: SitePayment) -> Decimal:
    rem = _money(payment.total_amount) - _money(payment.amount_paid)
    return rem if rem > 0 else Decimal("0.00")


def _to_view(payment: SitePayment, include_ledger: bool = False) -> SitePaymentView:
    ledger = []
    if include_ledger and payment.ledger_entries is not None:
        ledger = payment.ledger_entries
    return SitePaymentView(
        id=payment.id,
        title=payment.title,
        start_date=payment.start_date,
        end_date=payment.end_date,
        duration_days=payment.duration_days,
        monthly_amount=_money(payment.monthly_amount),
        total_amount=_money(payment.total_amount),
        amount_paid=_money(payment.amount_paid),
        remaining_amount=_remaining(payment),
        comment=payment.comment,
        status=payment.status,
        created_by_id=payment.created_by_id,
        created_at=payment.created_at,
        updated_at=payment.updated_at,
        ledger=ledger,
    )


def _resolve_period(payload: SitePaymentCreate):
    start = payload.start_date
    if payload.end_date is not None:
        end = payload.end_date
        if end < start:
            raise HTTPException(status_code=400, detail="Дата конца не может быть раньше даты начала")
        duration_days = (end - start).days
        if duration_days < 1:
            # same calendar day → treat as 1 day of service
            duration_days = 1
            end = start
    else:
        duration_days = int(payload.duration_days)
        if duration_days < 1:
            raise HTTPException(status_code=400, detail="Количество дней должно быть не меньше 1")
        end = start + timedelta(days=duration_days)
    return start, end, duration_days


def _calc_total(monthly_amount: Decimal, duration_days: int) -> Decimal:
    return _money(monthly_amount * (Decimal(duration_days) / Decimal(30)))


def _get_payment(db: Session, payment_id: int) -> SitePayment:
    row = (
        db.query(SitePayment)
        .options(joinedload(SitePayment.ledger_entries))
        .filter(SitePayment.id == payment_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Платёж не найден")
    return row


@router.get("", response_model=List[SitePaymentView])
def list_site_payments(
    scope: str = Query("active", pattern="^(active|history)$"),
    date_from: Optional[date] = Query(None, description="Начало периода (по дате старта услуги)"),
    date_to: Optional[date] = Query(None, description="Конец периода (по дате старта услуги)"),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(status_code=400, detail="Дата начала периода не может быть позже даты конца")

    q = db.query(SitePayment).order_by(SitePayment.created_at.desc())
    if scope == "active":
        q = q.filter(SitePayment.status.in_(ACTIVE_STATUSES))
    if date_from is not None:
        q = q.filter(SitePayment.start_date >= date_from)
    if date_to is not None:
        q = q.filter(SitePayment.start_date <= date_to)
    rows = q.all()
    return [_to_view(row) for row in rows]


@router.get("/{payment_id}", response_model=SitePaymentView)
def get_site_payment(
    payment_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    del current_user
    return _to_view(_get_payment(db, payment_id), include_ledger=True)


@router.post("", response_model=SitePaymentView, status_code=status.HTTP_201_CREATED)
def create_site_payment(
    payload: SitePaymentCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    start, end, duration_days = _resolve_period(payload)
    monthly = _money(payload.monthly_amount)
    total = _calc_total(monthly, duration_days)
    row = SitePayment(
        title=payload.title.strip(),
        start_date=start,
        end_date=end,
        duration_days=duration_days,
        monthly_amount=monthly,
        total_amount=total,
        amount_paid=Decimal("0.00"),
        comment=(payload.comment or "").strip() or None,
        status="active",
        created_by_id=current_user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    log_audit(
        db,
        event_type="site_payment_created",
        category="admin",
        summary=f"Создан платёж сайта: {row.title} (всего {total})",
        user=current_user,
    )
    return _to_view(row)


@router.patch("/{payment_id}", response_model=SitePaymentView)
def update_site_payment(
    payment_id: int,
    payload: SitePaymentUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = _get_payment(db, payment_id)
    data = payload.model_dump(exclude_unset=True)

    if "title" in data and data["title"] is not None:
        row.title = str(data["title"]).strip()
    if "comment" in data:
        comment = data["comment"]
        row.comment = (str(comment).strip() if comment is not None else "") or None

    start = data.get("start_date", row.start_date)
    end = data.get("end_date")
    days = data.get("duration_days")
    period_touched = any(k in data for k in ("start_date", "end_date", "duration_days"))

    if period_touched:
        if end is not None:
            if end < start:
                raise HTTPException(status_code=400, detail="Дата конца не может быть раньше даты начала")
            duration_days = (end - start).days
            if duration_days < 1:
                duration_days = 1
                end = start
        elif days is not None:
            duration_days = int(days)
            if duration_days < 1:
                raise HTTPException(status_code=400, detail="Количество дней должно быть не меньше 1")
            end = start + timedelta(days=duration_days)
        else:
            # only start_date changed — keep duration
            duration_days = int(row.duration_days)
            end = start + timedelta(days=duration_days)
        row.start_date = start
        row.end_date = end
        row.duration_days = duration_days

    if "monthly_amount" in data and data["monthly_amount"] is not None:
        row.monthly_amount = _money(data["monthly_amount"])

    if period_touched or "monthly_amount" in data:
        row.total_amount = _calc_total(_money(row.monthly_amount), int(row.duration_days))
        paid = _money(row.amount_paid)
        total = _money(row.total_amount)
        if paid > total:
            row.amount_paid = total
            paid = total
        if row.status not in ("cancelled", "paused"):
            row.status = "paid" if paid >= total else "active"

    db.commit()
    row = _get_payment(db, payment_id)
    log_audit(
        db,
        event_type="site_payment_updated",
        category="admin",
        summary=f"Обновлён платёж сайта #{payment_id}: {row.title}",
        user=current_user,
    )
    return _to_view(row, include_ledger=True)


@router.post("/{payment_id}/pay", response_model=SitePaymentView)
def pay_site_payment(
    payment_id: int,
    payload: SitePaymentPay,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = _get_payment(db, payment_id)
    if row.status == "cancelled":
        raise HTTPException(status_code=400, detail="Нельзя оплатить отменённый платёж")
    if row.status == "paid":
        raise HTTPException(status_code=400, detail="Платёж уже полностью оплачен")

    amount = _money(payload.amount)
    remaining = _remaining(row)
    if amount > remaining:
        raise HTTPException(
            status_code=400,
            detail=f"Сумма больше остатка к оплате ({remaining})",
        )

    row.amount_paid = _money(row.amount_paid) + amount
    entry = SitePaymentLedger(
        payment_id=row.id,
        amount=amount,
        note=(payload.note or "").strip() or None,
        created_by_id=current_user.id,
    )
    db.add(entry)

    if _money(row.amount_paid) >= _money(row.total_amount):
        row.amount_paid = _money(row.total_amount)
        row.status = "paid"
    elif row.status == "paused":
        pass  # keep paused
    else:
        row.status = "active"

    db.commit()
    row = _get_payment(db, payment_id)
    log_audit(
        db,
        event_type="site_payment_pay",
        category="admin",
        summary=f"Оплата по платежу сайта #{payment_id}: {amount}",
        user=current_user,
    )
    return _to_view(row, include_ledger=True)


@router.post("/{payment_id}/pause", response_model=SitePaymentView)
def pause_site_payment(
    payment_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = _get_payment(db, payment_id)
    if row.status in ("cancelled", "paid"):
        raise HTTPException(status_code=400, detail="Нельзя поставить на паузу этот платёж")
    row.status = "paused"
    db.commit()
    db.refresh(row)
    log_audit(
        db,
        event_type="site_payment_pause",
        category="admin",
        summary=f"Платёж сайта #{payment_id} на паузе",
        user=current_user,
    )
    return _to_view(row, include_ledger=True)


@router.post("/{payment_id}/resume", response_model=SitePaymentView)
def resume_site_payment(
    payment_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = _get_payment(db, payment_id)
    if row.status != "paused":
        raise HTTPException(status_code=400, detail="Платёж не на паузе")
    row.status = "active"
    db.commit()
    db.refresh(row)
    log_audit(
        db,
        event_type="site_payment_resume",
        category="admin",
        summary=f"Платёж сайта #{payment_id} снят с паузы",
        user=current_user,
    )
    return _to_view(row, include_ledger=True)


@router.post("/{payment_id}/cancel", response_model=SitePaymentView)
def cancel_site_payment(
    payment_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = _get_payment(db, payment_id)
    if row.status == "cancelled":
        raise HTTPException(status_code=400, detail="Платёж уже отменён")
    row.status = "cancelled"
    db.commit()
    db.refresh(row)
    log_audit(
        db,
        event_type="site_payment_cancel",
        category="admin",
        summary=f"Платёж сайта #{payment_id} отменён",
        user=current_user,
    )
    return _to_view(row, include_ledger=True)
