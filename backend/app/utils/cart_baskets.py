"""Helpers for named new-parts baskets (user and guest carts)."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.carts import (
    DEFAULT_NEW_PARTS_BASKET_NAME,
    GuestNewPartsBasket,
    GuestNewPartsCart,
    NewPartsBasket,
    NewPartsCart,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_basket_name(name: str) -> str:
    cleaned = (name or "").strip()
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Укажите название корзины",
        )
    if len(cleaned) > 100:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Название корзины не должно превышать 100 символов",
        )
    return cleaned


def get_or_create_default_user_basket(db: Session, cart_id: int, user_id: int) -> NewPartsBasket:
    basket = (
        db.query(NewPartsBasket)
        .filter(
            NewPartsBasket.cart_id == cart_id,
            NewPartsBasket.user_id == user_id,
            NewPartsBasket.is_default.is_(True),
        )
        .first()
    )
    if basket:
        return basket

    basket = (
        db.query(NewPartsBasket)
        .filter(NewPartsBasket.cart_id == cart_id, NewPartsBasket.user_id == user_id)
        .order_by(NewPartsBasket.id.asc())
        .first()
    )
    if basket:
        if not basket.is_default:
            basket.is_default = True
            basket.updated_at = _utcnow()
            db.flush()
        return basket

    basket = NewPartsBasket(
        cart_id=cart_id,
        user_id=user_id,
        name=DEFAULT_NEW_PARTS_BASKET_NAME,
        is_default=True,
        sort_order=0,
    )
    db.add(basket)
    db.flush()
    return basket


def get_or_create_default_guest_basket(db: Session, guest_cart_id: int) -> GuestNewPartsBasket:
    basket = (
        db.query(GuestNewPartsBasket)
        .filter(
            GuestNewPartsBasket.guest_cart_id == guest_cart_id,
            GuestNewPartsBasket.is_default.is_(True),
        )
        .first()
    )
    if basket:
        return basket

    basket = (
        db.query(GuestNewPartsBasket)
        .filter(GuestNewPartsBasket.guest_cart_id == guest_cart_id)
        .order_by(GuestNewPartsBasket.id.asc())
        .first()
    )
    if basket:
        if not basket.is_default:
            basket.is_default = True
            basket.updated_at = _utcnow()
            db.flush()
        return basket

    basket = GuestNewPartsBasket(
        guest_cart_id=guest_cart_id,
        name=DEFAULT_NEW_PARTS_BASKET_NAME,
        is_default=True,
        sort_order=0,
    )
    db.add(basket)
    db.flush()
    return basket


def list_user_baskets(db: Session, cart_id: int, user_id: int) -> list[NewPartsBasket]:
    get_or_create_default_user_basket(db, cart_id, user_id)
    return (
        db.query(NewPartsBasket)
        .filter(NewPartsBasket.cart_id == cart_id, NewPartsBasket.user_id == user_id)
        .order_by(NewPartsBasket.is_default.desc(), NewPartsBasket.sort_order.asc(), NewPartsBasket.id.asc())
        .all()
    )


def list_guest_baskets(db: Session, guest_cart_id: int) -> list[GuestNewPartsBasket]:
    get_or_create_default_guest_basket(db, guest_cart_id)
    return (
        db.query(GuestNewPartsBasket)
        .filter(GuestNewPartsBasket.guest_cart_id == guest_cart_id)
        .order_by(
            GuestNewPartsBasket.is_default.desc(),
            GuestNewPartsBasket.sort_order.asc(),
            GuestNewPartsBasket.id.asc(),
        )
        .all()
    )


def resolve_user_basket(
    db: Session,
    cart_id: int,
    user_id: int,
    basket_id: int | None = None,
) -> NewPartsBasket:
    if basket_id is None:
        return get_or_create_default_user_basket(db, cart_id, user_id)

    basket = (
        db.query(NewPartsBasket)
        .filter(
            NewPartsBasket.id == basket_id,
            NewPartsBasket.cart_id == cart_id,
            NewPartsBasket.user_id == user_id,
        )
        .first()
    )
    if not basket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Корзина не найдена",
        )
    return basket


def resolve_guest_basket(
    db: Session,
    guest_cart_id: int,
    basket_id: int | None = None,
) -> GuestNewPartsBasket:
    if basket_id is None:
        return get_or_create_default_guest_basket(db, guest_cart_id)

    basket = (
        db.query(GuestNewPartsBasket)
        .filter(
            GuestNewPartsBasket.id == basket_id,
            GuestNewPartsBasket.guest_cart_id == guest_cart_id,
        )
        .first()
    )
    if not basket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Корзина не найдена",
        )
    return basket


def create_user_basket(db: Session, cart_id: int, user_id: int, name: str) -> NewPartsBasket:
    cleaned = _normalize_basket_name(name)
    get_or_create_default_user_basket(db, cart_id, user_id)
    existing = (
        db.query(NewPartsBasket)
        .filter(
            NewPartsBasket.cart_id == cart_id,
            NewPartsBasket.user_id == user_id,
            NewPartsBasket.name == cleaned,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Корзина с таким названием уже существует",
        )

    max_sort = (
        db.query(NewPartsBasket.sort_order)
        .filter(NewPartsBasket.cart_id == cart_id, NewPartsBasket.user_id == user_id)
        .order_by(NewPartsBasket.sort_order.desc())
        .first()
    )
    next_sort = (max_sort[0] if max_sort else 0) + 1
    basket = NewPartsBasket(
        cart_id=cart_id,
        user_id=user_id,
        name=cleaned,
        is_default=False,
        sort_order=next_sort,
    )
    db.add(basket)
    db.flush()
    return basket


def create_guest_basket(db: Session, guest_cart_id: int, name: str) -> GuestNewPartsBasket:
    cleaned = _normalize_basket_name(name)
    get_or_create_default_guest_basket(db, guest_cart_id)
    existing = (
        db.query(GuestNewPartsBasket)
        .filter(
            GuestNewPartsBasket.guest_cart_id == guest_cart_id,
            GuestNewPartsBasket.name == cleaned,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Корзина с таким названием уже существует",
        )

    max_sort = (
        db.query(GuestNewPartsBasket.sort_order)
        .filter(GuestNewPartsBasket.guest_cart_id == guest_cart_id)
        .order_by(GuestNewPartsBasket.sort_order.desc())
        .first()
    )
    next_sort = (max_sort[0] if max_sort else 0) + 1
    basket = GuestNewPartsBasket(
        guest_cart_id=guest_cart_id,
        name=cleaned,
        is_default=False,
        sort_order=next_sort,
    )
    db.add(basket)
    db.flush()
    return basket


def rename_user_basket(
    db: Session,
    cart_id: int,
    user_id: int,
    basket_id: int,
    name: str,
) -> NewPartsBasket:
    cleaned = _normalize_basket_name(name)
    basket = resolve_user_basket(db, cart_id, user_id, basket_id)
    if basket.is_default and cleaned != basket.name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Основную корзину нельзя переименовать",
        )

    conflict = (
        db.query(NewPartsBasket)
        .filter(
            NewPartsBasket.cart_id == cart_id,
            NewPartsBasket.user_id == user_id,
            NewPartsBasket.name == cleaned,
            NewPartsBasket.id != basket.id,
        )
        .first()
    )
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Корзина с таким названием уже существует",
        )

    basket.name = cleaned
    basket.updated_at = _utcnow()
    db.flush()
    return basket


def rename_guest_basket(
    db: Session,
    guest_cart_id: int,
    basket_id: int,
    name: str,
) -> GuestNewPartsBasket:
    cleaned = _normalize_basket_name(name)
    basket = resolve_guest_basket(db, guest_cart_id, basket_id)
    if basket.is_default and cleaned != basket.name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Основную корзину нельзя переименовать",
        )

    conflict = (
        db.query(GuestNewPartsBasket)
        .filter(
            GuestNewPartsBasket.guest_cart_id == guest_cart_id,
            GuestNewPartsBasket.name == cleaned,
            GuestNewPartsBasket.id != basket.id,
        )
        .first()
    )
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Корзина с таким названием уже существует",
        )

    basket.name = cleaned
    basket.updated_at = _utcnow()
    db.flush()
    return basket


def load_user_basket_items(
    db: Session,
    cart_id: int,
    user_id: int,
    basket_id: int | None = None,
) -> list[NewPartsCart]:
    basket = resolve_user_basket(db, cart_id, user_id, basket_id)
    return (
        db.query(NewPartsCart)
        .filter(
            NewPartsCart.cart_id == cart_id,
            NewPartsCart.user_id == user_id,
            NewPartsCart.basket_id == basket.id,
        )
        .all()
    )


def load_guest_basket_items(
    db: Session,
    guest_cart_id: int,
    basket_id: int | None = None,
) -> list[GuestNewPartsCart]:
    basket = resolve_guest_basket(db, guest_cart_id, basket_id)
    return (
        db.query(GuestNewPartsCart)
        .filter(
            GuestNewPartsCart.guest_cart_id == guest_cart_id,
            GuestNewPartsCart.basket_id == basket.id,
        )
        .all()
    )


def find_or_create_user_basket_by_name(
    db: Session,
    cart_id: int,
    user_id: int,
    name: str,
) -> NewPartsBasket:
    cleaned = _normalize_basket_name(name)
    basket = (
        db.query(NewPartsBasket)
        .filter(
            NewPartsBasket.cart_id == cart_id,
            NewPartsBasket.user_id == user_id,
            NewPartsBasket.name == cleaned,
        )
        .first()
    )
    if basket:
        return basket
    return create_user_basket(db, cart_id, user_id, cleaned)
