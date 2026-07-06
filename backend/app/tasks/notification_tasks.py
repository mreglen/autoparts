from __future__ import annotations

import logging
from typing import Any

from app.celery_app import celery_app
from app.db.database import SessionLocal
from app.models.notification import PushSubscription
from app.models.user import User
from app.utils.email import send_notification_email

logger = logging.getLogger(__name__)


def deliver_user_notification(
    user_id: int,
    event_type: str,
    push_data: dict[str, Any] | None,
    email_subject: str,
    email_body: str,
) -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.warning("Notification skipped: user %s not found (%s)", user_id, event_type)
            return

        notify_push = user.notify_push_enabled if user.notify_push_enabled is not None else True
        notify_email = user.notify_email_enabled if user.notify_email_enabled is not None else True

        if notify_push and push_data:
            has_subscription = (
                db.query(PushSubscription.id)
                .filter(
                    PushSubscription.user_id == user_id,
                    PushSubscription.is_active.is_(True),
                )
                .first()
            )
            if has_subscription:
                try:
                    from app.routers.notifications import send_push_notification

                    send_push_notification(user_id, push_data, db)
                    logger.info("Push sent to user %s (%s)", user_id, event_type)
                except Exception:
                    logger.exception("Push failed for user %s (%s)", user_id, event_type)

        if notify_email and user.email:
            try:
                sent = send_notification_email(user.email, email_subject, email_body)
                if sent:
                    logger.info("Email sent to user %s (%s)", user_id, event_type)
                else:
                    logger.warning("Email not sent to user %s (%s)", user_id, event_type)
            except Exception:
                logger.exception("Email failed for user %s (%s)", user_id, event_type)
    finally:
        db.close()


@celery_app.task(name="notifications.send_user_notification")
def send_user_notification(
    user_id: int,
    event_type: str,
    push_data: dict[str, Any] | None,
    email_subject: str,
    email_body: str,
) -> None:
    deliver_user_notification(user_id, event_type, push_data, email_subject, email_body)
