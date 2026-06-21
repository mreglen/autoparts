import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Request, Response
from sqlalchemy.orm import Session, selectinload

from app.models.carts import Cart, NewPartsCart, UsedPartsCart, GuestCart, GuestNewPartsCart, GuestUsedPartsCart
from app.models.product import Product


GUEST_CART_HEADER_NAME = "X-Guest-Cart-Token"
GUEST_CART_TTL_HOURS = 24


def _utcnow() -> datetime:
    # Use timezone-aware UTC to match TIMESTAMPTZ from Postgres.
    return datetime.now(timezone.utc)


def _expires_at() -> datetime:
    return _utcnow() + timedelta(hours=GUEST_CART_TTL_HOURS)


def hash_guest_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def get_guest_token_from_request(request: Request) -> Optional[str]:
    # Берём токен гостевой корзины только из заголовка, не из cookie.
    token = request.headers.get(GUEST_CART_HEADER_NAME)
    if token:
        return token.strip()
    return None


def get_guest_cart_by_token(db: Session, raw_token: str) -> Optional[GuestCart]:
    token_hash = hash_guest_token(raw_token)
    guest_cart = db.query(GuestCart).filter(GuestCart.token_hash == token_hash).first()
    if not guest_cart:
        return None
    if guest_cart.expires_at <= _utcnow():
        db.delete(guest_cart)
        db.commit()
        return None
    return guest_cart


def load_guest_cart_with_items(db: Session, raw_token: str) -> Optional[GuestCart]:
    """Гостевая корзина с eager-load позиций и product.organization."""
    token_hash = hash_guest_token(raw_token)
    guest_cart = (
        db.query(GuestCart)
        .options(
            selectinload(GuestCart.new_parts_items),
            selectinload(GuestCart.used_parts_items)
            .selectinload(GuestUsedPartsCart.product)
            .selectinload(Product.organization),
        )
        .filter(GuestCart.token_hash == token_hash)
        .first()
    )
    if not guest_cart:
        return None
    if guest_cart.expires_at <= _utcnow():
        db.delete(guest_cart)
        db.commit()
        return None
    return guest_cart


def get_or_create_guest_cart(db: Session, request: Request, response: Response) -> GuestCart:
    raw_token = get_guest_token_from_request(request)
    guest_cart = get_guest_cart_by_token(db, raw_token) if raw_token else None
    if guest_cart:
        return guest_cart

    raw_token = secrets.token_urlsafe(48)
    guest_cart = GuestCart(token_hash=hash_guest_token(raw_token), expires_at=_expires_at())
    db.add(guest_cart)
    db.commit()
    db.refresh(guest_cart)
    # Сообщаем фронту идентификатор гостевой корзины только через заголовок.
    response.headers[GUEST_CART_HEADER_NAME] = raw_token
    return guest_cart


def touch_guest_cart(db: Session, guest_cart: GuestCart) -> None:
    guest_cart.expires_at = _expires_at()
    guest_cart.updated_at = _utcnow()
    db.commit()


def get_or_create_user_cart(db: Session, user_id: int) -> Cart:
    cart = db.query(Cart).filter(Cart.user_id == user_id).first()
    if not cart:
        cart = Cart(user_id=user_id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return cart


def merge_guest_cart_to_user(db: Session, guest_cart: GuestCart, user_id: int) -> None:
    user_cart = get_or_create_user_cart(db, user_id)

    for guest_item in guest_cart.new_parts_items:
        existing = db.query(NewPartsCart).filter(
            NewPartsCart.cart_id == user_cart.id,
            NewPartsCart.stock_id == guest_item.stock_id,
            NewPartsCart.brand == guest_item.brand,
            NewPartsCart.partnumber == guest_item.partnumber,
        ).first()
        if existing:
            existing.quantity += guest_item.quantity
            existing.updated_at = _utcnow()
        else:
            db.add(
                NewPartsCart(
                    cart_id=user_cart.id,
                    user_id=user_id,
                    brand=guest_item.brand,
                    partnumber=guest_item.partnumber,
                    name=guest_item.name,
                    delivery=guest_item.delivery,
                    quantity=guest_item.quantity,
                    price=guest_item.price,
                    stock_id=guest_item.stock_id,
                    guid=guest_item.guid,
                    delivery_start=guest_item.delivery_start,
                    delivery_end=guest_item.delivery_end,
                )
            )

    for guest_item in guest_cart.used_parts_items:
        if guest_item.product_id:
            product_exists = db.query(Product.id).filter(Product.id == guest_item.product_id).first()
            if not product_exists:
                continue

        existing = db.query(UsedPartsCart).filter(
            UsedPartsCart.cart_id == user_cart.id,
            UsedPartsCart.product_id == guest_item.product_id,
        ).first()
        if existing:
            existing.quantity += guest_item.quantity
            existing.updated_at = _utcnow()
        else:
            db.add(
                UsedPartsCart(
                    cart_id=user_cart.id,
                    user_id=user_id,
                    product_id=guest_item.product_id,
                    quantity=guest_item.quantity,
                    brand=guest_item.brand,
                    partnumber=guest_item.partnumber,
                    delivery=guest_item.delivery,
                    price=guest_item.price,
                )
            )

    db.delete(guest_cart)
    db.commit()


def merge_guest_cart_from_request(db: Session, request: Request, response: Response, user_id: int) -> bool:
    raw_token = get_guest_token_from_request(request)
    if not raw_token:
        return False
    guest_cart = get_guest_cart_by_token(db, raw_token)
    if not guest_cart:
        return False
    merge_guest_cart_to_user(db, guest_cart, user_id)
    return True


def cleanup_expired_guest_carts(db: Session) -> int:
    expired = db.query(GuestCart).filter(GuestCart.expires_at <= _utcnow()).all()
    deleted_count = len(expired)
    for item in expired:
        db.delete(item)
    db.commit()
    return deleted_count
