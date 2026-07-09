import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from pywebpush import webpush, WebPushException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.config import settings
from app.db.database import get_db
from app.models.notification import PushSubscription
from app.models.user import User
from app.schemas.notification import (
    NotificationPreferencesResponse,
    NotificationPreferencesUpdate,
    NotificationPrefs,
    PushSubscriptionCreate,
)
from app.services.notification_service import (
    get_user_notification_prefs,
    merge_notification_prefs_patch,
)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])
logger = logging.getLogger(__name__)


def _vapid_claims() -> dict:
    email = (settings.EMAIL_FROM or "support@svoygarage.ru").strip()
    if not email.startswith("mailto:"):
        email = f"mailto:{email}"
    return {"sub": email}


def _prefs_response(user: User, db: Session) -> NotificationPreferencesResponse:
    return NotificationPreferencesResponse(
        notification_prefs=NotificationPrefs.model_validate(get_user_notification_prefs(user)),
        has_push_subscription=_user_has_push_subscription(db, user.id),
    )


@router.post("/subscribe")
def subscribe_to_push(
    subscription_data: PushSubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Save push subscription for user"""
    
    # Check if subscription already exists
    existing = db.query(PushSubscription).filter(
        PushSubscription.user_id == current_user.id,
        PushSubscription.endpoint == subscription_data.endpoint
    ).first()
    
    if existing:
        existing.is_active = True
        existing.p256dh = subscription_data.p256dh
        existing.auth = subscription_data.auth
        db.commit()
        return {"message": "Subscription updated"}
    
    new_sub = PushSubscription(
        user_id=current_user.id,
        endpoint=subscription_data.endpoint,
        p256dh=subscription_data.p256dh,
        auth=subscription_data.auth,
        user_agent=subscription_data.user_agent
    )
    
    db.add(new_sub)
    db.commit()
    
    return {"message": "Subscription created"}


@router.post("/unsubscribe")
def unsubscribe_from_push(
    endpoint: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove push subscription"""
    
    subscription = db.query(PushSubscription).filter(
        PushSubscription.user_id == current_user.id,
        PushSubscription.endpoint == endpoint
    ).first()
    
    if subscription:
        subscription.is_active = False
        db.commit()
    
    return {"message": "Unsubscribed"}


@router.get("/vapid-public-key")
def get_vapid_public_key():
    """Return VAPID public key for client subscription"""
    return {"public_key": settings.VAPID_PUBLIC_KEY}


def _user_has_push_subscription(db: Session, user_id: int) -> bool:
    return (
        db.query(PushSubscription.id)
        .filter(
            PushSubscription.user_id == user_id,
            PushSubscription.is_active.is_(True),
        )
        .first()
        is not None
    )


@router.get("/preferences", response_model=NotificationPreferencesResponse)
def get_notification_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _prefs_response(current_user, db)


@router.patch("/preferences", response_model=NotificationPreferencesResponse)
def update_notification_preferences(
    payload: NotificationPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.notification_prefs is not None:
        current_prefs = get_user_notification_prefs(current_user)
        patch = payload.notification_prefs.model_dump(exclude_unset=True)
        merged = merge_notification_prefs_patch(current_prefs, patch)
        current_user.notification_prefs = merged
    db.commit()
    db.refresh(current_user)
    return _prefs_response(current_user, db)


def send_push_notification(user_id: int, message_data: dict, db: Session):
    """Send push notification to all user's active subscriptions"""
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        return

    subscriptions = db.query(PushSubscription).filter(
        PushSubscription.user_id == user_id,
        PushSubscription.is_active == True
    ).all()
    
    for sub in subscriptions:
        try:
            subscription_info = {
                "endpoint": sub.endpoint,
                "keys": {
                    "p256dh": sub.p256dh,
                    "auth": sub.auth
                }
            }
            
            webpush(
                subscription_info=subscription_info,
                data=json.dumps(message_data),
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims=_vapid_claims()
            )
            
            # Update last_used
            db.query(PushSubscription).filter(
                PushSubscription.id == sub.id
            ).update({"last_used": func.now()})
            
        except WebPushException as e:
            logger.warning("Push notification failed for user %s: %s", user_id, e)
            # Mark subscription as inactive if it's expired
            if e.response and e.response.status_code in [404, 410]:
                sub.is_active = False
                db.commit()
        except Exception as e:
            logger.exception("Unexpected error sending push to user %s: %s", user_id, e)
    
    db.commit()
