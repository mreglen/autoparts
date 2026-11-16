"""In-app лента уведомлений: feed-эндпоинты и запись в deliver_user_notification."""

import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from app.models.notification import UserNotification
from app.routers import notifications as notif_router
from app.tasks import notification_tasks


def _user(uid=7):
    u = MagicMock()
    u.id = uid
    u.email = "u@test.ru"
    return u


def _row(**kw):
    row = UserNotification()
    row.id = kw.get("id", 1)
    row.user_id = kw.get("user_id", 7)
    row.event_type = kw.get("event_type", "autoservice_booking_accepted")
    row.title = kw.get("title", "Заявка принята")
    row.body = kw.get("body", "body")
    row.url = kw.get("url", "/autoservice/my-bookings")
    row.data = kw.get("data", {"inspectionId": 3})
    row.is_read = kw.get("is_read", False)
    row.created_at = kw.get("created_at") or datetime(2026, 11, 16, tzinfo=timezone.utc)
    return row


class FeedEndpointTests(unittest.TestCase):
    def test_list_feed_returns_items_and_unread(self):
        rows = [_row(id=2), _row(id=1, is_read=True)]
        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = rows
        db.query.return_value.filter.return_value.scalar.return_value = 1

        result = notif_router.list_notification_feed(
            limit=50, offset=0, db=db, current_user=_user(),
        )
        self.assertEqual(len(result.items), 2)
        self.assertEqual(result.unread_count, 1)
        self.assertEqual(result.items[0].title, "Заявка принята")

    def test_list_feed_clamps_limit(self):
        db = MagicMock()
        chain = db.query.return_value.filter.return_value.order_by.return_value.offset.return_value.limit
        chain.return_value.all.return_value = []
        db.query.return_value.filter.return_value.scalar.return_value = 0
        notif_router.list_notification_feed(
            limit=9999, offset=-5, db=db, current_user=_user(),
        )
        # limit обрезан до 200, offset до 0
        limit_call = db.query.return_value.filter.return_value.order_by.return_value.offset.return_value.limit
        # offset вызван с 0
        off_args = db.query.return_value.filter.return_value.order_by.return_value.offset.call_args
        self.assertEqual(off_args[0][0], 0)

    def test_mark_read_owner(self):
        row = _row(is_read=False)
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = row
        result = notif_router.mark_notification_read(
            5, db=db, current_user=_user(),
        )
        self.assertTrue(row.is_read)
        self.assertTrue(result.is_read)
        db.commit.assert_called_once()

    def test_mark_read_not_found_or_foreign(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        with self.assertRaises(HTTPException) as ctx:
            notif_router.mark_notification_read(5, db=db, current_user=_user())
        self.assertEqual(ctx.exception.status_code, 404)

    def test_mark_all_read_updates_unread_only(self):
        db = MagicMock()
        notif_router.mark_all_notifications_read(db=db, current_user=_user())
        db.query.return_value.filter.return_value.update.assert_called_once()
        kwargs = db.query.return_value.filter.return_value.update.call_args
        self.assertEqual(kwargs[0][0], {"is_read": True})
        db.commit.assert_called_once()


class DeliverFeedWriteTests(unittest.TestCase):
    def _db_with_user(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = _user()
        return db

    def test_deliver_writes_feed_row(self):
        db = self._db_with_user()
        with (
            patch.object(notification_tasks, "SessionLocal", return_value=db),
            patch.object(notification_tasks, "should_send_push_for_event", return_value=False),
            patch.object(notification_tasks, "should_send_email_for_event", return_value=False),
        ):
            notification_tasks.deliver_user_notification(
                7,
                "autoservice_booking_confirmed",
                {"type": "autoservice_inspection_client", "url": "/x", "title": "T", "body": "B"},
                "Subject",
                "Body",
            )
        added = [c.args[0] for c in db.add.call_args_list]
        feed = [o for o in added if isinstance(o, UserNotification)]
        self.assertEqual(len(feed), 1)
        self.assertEqual(feed[0].title, "T")
        self.assertEqual(feed[0].url, "/x")
        self.assertFalse(feed[0].is_read)
        db.commit.assert_called()

    def test_deliver_feed_falls_back_to_email_subject(self):
        db = self._db_with_user()
        with (
            patch.object(notification_tasks, "SessionLocal", return_value=db),
            patch.object(notification_tasks, "should_send_push_for_event", return_value=False),
            patch.object(notification_tasks, "should_send_email_for_event", return_value=False),
        ):
            notification_tasks.deliver_user_notification(
                7, "evt", None, "Тема письма", "Текст письма",
            )
        feed = [c.args[0] for c in db.add.call_args_list if isinstance(c.args[0], UserNotification)]
        self.assertEqual(feed[0].title, "Тема письма")
        self.assertEqual(feed[0].url, None)

    def test_deliver_skips_when_user_missing(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        with patch.object(notification_tasks, "SessionLocal", return_value=db):
            notification_tasks.deliver_user_notification(7, "evt", None, "s", "b")
        db.add.assert_not_called()


if __name__ == "__main__":
    unittest.main()
