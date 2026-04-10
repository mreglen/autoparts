from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pywebpush import webpush, WebPushException
from app.db.database import get_db
from app.models.notification import PushSubscription
from app.schemas.notification import PushSubscriptionCreate, PushSubscriptionResponse
from app.core.auth import get_current_user
from app.models.user import User
from app.core.config import settings
import json

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

# VAPID config
VAPID_CLAIMS = {
    "sub": "mailto:support@autoparts.com"  # Update with your email
}


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


def send_push_notification(user_id: int, message_data: dict, db: Session):
    """Send push notification to all user's active subscriptions"""
    from sqlalchemy import func
    
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
                vapid_claims=VAPID_CLAIMS
            )
            
            # Update last_used
            db.query(PushSubscription).filter(
                PushSubscription.id == sub.id
            ).update({"last_used": func.now()})
            
        except WebPushException as e:
            print(f"Push notification failed for user {user_id}: {e}")
            # Mark subscription as inactive if it's expired
            if e.response and e.response.status_code in [404, 410]:
                sub.is_active = False
                db.commit()
        except Exception as e:
            print(f"Unexpected error sending push: {e}")
    
    db.commit()
