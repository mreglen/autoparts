"""Search query subscriptions and match notifications."""
from __future__ import annotations

import logging
import re
import secrets
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.product import Product as ProductModel
from app.models.user_engagement import SearchSubscription, SearchSubscriptionNotification
from app.services.local_product_search import _build_match_conditions, _in_stock_filter
from app.services.notification_service import (
    EVENT_SEARCH_SUBSCRIPTION_MATCH,
    dispatch_user_notification,
)
from app.services.yandex_feed_xml_service import _resolve_site_origin
from app.utils.product_urls import build_product_page_url
from app.utils.search_query import parse_search_query

logger = logging.getLogger(__name__)

MIN_QUERY_LENGTH = 2
_WS_RE = re.compile(r"\s+")


def normalize_subscription_query(q: str) -> str:
    text = _WS_RE.sub(" ", (q or "").strip())
    return text.casefold()


def product_matches_subscription_query(
    db: Session,
    product: ProductModel,
    query_text: str,
) -> bool:
    if bool(product.is_new) or int(product.quantity or 0) <= 0:
        return False

    parsed = parse_search_query(query_text)
    if not parsed.has_terms:
        return False

    conditions = _build_match_conditions(parsed)
    if not conditions:
        return False

    matched = (
        db.query(ProductModel.id)
        .filter(
            ProductModel.id == product.id,
            or_(*conditions),
            _in_stock_filter(),
            ProductModel.is_new.is_(False),
        )
        .first()
    )
    return matched is not None


def create_search_subscription(db: Session, user_id: int, query_text: str) -> SearchSubscription:
    raw = (query_text or "").strip()
    if len(raw) < MIN_QUERY_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Запрос слишком короткий",
        )

    normalized = normalize_subscription_query(raw)
    existing = (
        db.query(SearchSubscription)
        .filter(
            SearchSubscription.user_id == user_id,
            SearchSubscription.query_normalized == normalized,
        )
        .first()
    )
    if existing:
        if not existing.is_active:
            existing.is_active = True
            existing.query_text = raw
            db.commit()
            db.refresh(existing)
        return existing

    row = SearchSubscription(
        user_id=user_id,
        query_text=raw,
        query_normalized=normalized,
        is_active=True,
        unsubscribe_token=secrets.token_urlsafe(32),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_search_subscriptions(db: Session, user_id: int) -> list[SearchSubscription]:
    return (
        db.query(SearchSubscription)
        .filter(
            SearchSubscription.user_id == user_id,
            SearchSubscription.is_active.is_(True),
        )
        .order_by(SearchSubscription.created_at.desc())
        .all()
    )


def delete_search_subscription(db: Session, user_id: int, subscription_id: int) -> None:
    row = (
        db.query(SearchSubscription)
        .filter(
            SearchSubscription.id == subscription_id,
            SearchSubscription.user_id == user_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Подписка не найдена")
    row.is_active = False
    db.commit()


def deactivate_subscription_by_token(db: Session, token: str) -> bool:
    token_text = (token or "").strip()
    if not token_text:
        return False
    row = (
        db.query(SearchSubscription)
        .filter(SearchSubscription.unsubscribe_token == token_text)
        .first()
    )
    if not row:
        return False
    row.is_active = False
    db.commit()
    return True


def _build_unsubscribe_url(token: str) -> str:
    origin = _resolve_site_origin()
    return f"{origin}/api/public/search-subscriptions/unsubscribe?token={token}"


def _send_subscription_match_notification(
    db: Session,
    subscription: SearchSubscription,
    product: ProductModel,
) -> None:
    site_origin = _resolve_site_origin()
    product_url = build_product_page_url(product, site_origin)
    brand = (product.brand or "").strip()
    article = (product.article or "").strip()
    price = float(product.price or 0)
    title = f"{brand} {article}".strip() or (product.name or "Запчасть")
    query = subscription.query_text

    push_data = {
        "type": "search_subscription",
        "title": "Появилась запчасть по подписке",
        "body": f"«{query}»: {title}",
        "productId": product.id,
        "url": product_url.replace(site_origin, "") or f"/part/{product.id}",
    }
    unsubscribe_url = _build_unsubscribe_url(subscription.unsubscribe_token)
    email_body = (
        f"По вашей подписке «{query}» появилась запчасть:\n"
        f"{title} — {price:.0f} ₽\n\n"
        f"{product_url}\n\n"
        f"Отписаться: {unsubscribe_url}\n\n"
        f"С уважением,\nСвой Гараж"
    )
    dispatch_user_notification(
        subscription.user_id,
        event_type=EVENT_SEARCH_SUBSCRIPTION_MATCH,
        push_data=push_data,
        email_subject=f"Появилась запчасть по подписке «{query}»",
        email_body=email_body,
    )


def notify_subscribers_for_product(db: Session, product_id: int) -> int:
    product = (
        db.query(ProductModel)
        .filter(ProductModel.id == product_id)
        .first()
    )
    if not product or product.is_new or int(product.quantity or 0) <= 0:
        return 0

    subscriptions = (
        db.query(SearchSubscription)
        .filter(SearchSubscription.is_active.is_(True))
        .all()
    )
    if not subscriptions:
        return 0

    notified = 0
    now = datetime.now(timezone.utc)
    for subscription in subscriptions:
        if not product_matches_subscription_query(db, product, subscription.query_text):
            continue

        already = (
            db.query(SearchSubscriptionNotification.id)
            .filter(
                SearchSubscriptionNotification.subscription_id == subscription.id,
                SearchSubscriptionNotification.product_id == product.id,
            )
            .first()
        )
        if already:
            continue

        try:
            _send_subscription_match_notification(db, subscription, product)
            db.add(
                SearchSubscriptionNotification(
                    subscription_id=subscription.id,
                    product_id=product.id,
                )
            )
            subscription.last_notified_at = now
            notified += 1
        except Exception:
            logger.exception(
                "Failed to notify subscription %s for product %s",
                subscription.id,
                product.id,
            )

    if notified:
        db.commit()

    return notified


def maybe_notify_search_subscribers(
    product_id: int,
    *,
    previous_quantity: int | None = None,
) -> None:
    """Enqueue subscription check when a used product becomes available."""
    try:
        from app.tasks.search_subscription_tasks import check_product_search_subscriptions

        if previous_quantity is not None and previous_quantity > 0:
            return
        check_product_search_subscriptions.delay(product_id)
    except Exception as exc:
        logger.warning(
            "Search subscription enqueue failed for product %s: %s",
            product_id,
            exc,
        )
        try:
            from app.db.database import SessionLocal

            db = SessionLocal()
            try:
                product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
                if not product or product.is_new:
                    return
                qty = int(product.quantity or 0)
                if qty <= 0:
                    return
                if previous_quantity is not None and previous_quantity > 0:
                    return
                notify_subscribers_for_product(db, product_id)
            finally:
                db.close()
        except Exception:
            logger.exception("Search subscription sync fallback failed for product %s", product_id)
