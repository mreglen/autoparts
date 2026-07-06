import unittest
from unittest.mock import MagicMock, patch

from app.services.notification_service import (
    EVENT_STOCK_LOW,
    dispatch_user_notification,
    maybe_notify_stock_level,
    order_status_label,
)

try:
    from app.tasks.notification_tasks import deliver_user_notification

    HAS_NOTIFICATION_TASKS = True
except ModuleNotFoundError:
    HAS_NOTIFICATION_TASKS = False


class NotificationServiceTests(unittest.TestCase):
    def test_order_status_label_known(self):
        self.assertEqual(order_status_label("confirmed"), "Подтверждён")
        self.assertEqual(order_status_label("new_shipped"), "Отгружено")

    def test_order_status_label_unknown(self):
        self.assertEqual(order_status_label("custom_status"), "custom_status")

    @patch("app.services.notification_service._enqueue_or_send")
    def test_dispatch_user_notification_enqueues(self, mock_enqueue):
        dispatch_user_notification(
            7,
            event_type="test",
            push_data={"title": "T"},
            email_subject="Subject",
            email_body="Body",
        )
        mock_enqueue.assert_called_once_with(
            7,
            event_type="test",
            push_data={"title": "T"},
            email_subject="Subject",
            email_body="Body",
        )

    @patch("app.services.notification_service.dispatch_user_notification")
    def test_maybe_notify_stock_level_low_boundary(self, mock_dispatch):
        db = MagicMock()
        product = MagicMock()
        product.id = 10
        product.name = "Фильтр масляный"
        product.quantity = 2
        product.created_by = 5
        product.organization_id = "org1"

        maybe_notify_stock_level(db, product, previous_quantity=5)

        mock_dispatch.assert_called_once()
        kwargs = mock_dispatch.call_args.kwargs
        self.assertEqual(kwargs["event_type"], EVENT_STOCK_LOW)
        self.assertIn("низкий остаток", kwargs["email_subject"].lower())

    @patch("app.services.notification_service.dispatch_user_notification")
    def test_maybe_notify_stock_level_out_of_stock(self, mock_dispatch):
        db = MagicMock()
        product = MagicMock()
        product.id = 11
        product.name = "Колодки"
        product.quantity = 0
        product.created_by = 7
        product.organization_id = "org1"

        maybe_notify_stock_level(db, product, previous_quantity=1)

        mock_dispatch.assert_called_once()
        self.assertIn("нет в наличии", mock_dispatch.call_args.kwargs["email_subject"].lower())

    @patch("app.services.notification_service.dispatch_user_notification")
    def test_maybe_notify_stock_level_no_crossing(self, mock_dispatch):
        db = MagicMock()
        product = MagicMock()
        product.quantity = 5
        product.created_by = 1

        maybe_notify_stock_level(db, product, previous_quantity=6)
        maybe_notify_stock_level(db, product, previous_quantity=2)
        maybe_notify_stock_level(db, product, previous_quantity=0)

        mock_dispatch.assert_not_called()

    @unittest.skipUnless(HAS_NOTIFICATION_TASKS, "celery not installed")
    @patch("app.tasks.notification_tasks.send_notification_email")
    def test_deliver_respects_email_disabled(self, mock_email):
        db = MagicMock()
        user = MagicMock()
        user.notify_push_enabled = False
        user.notify_email_enabled = False
        user.email = "buyer@example.com"

        with patch("app.tasks.notification_tasks.SessionLocal") as mock_session_local:
            mock_session_local.return_value = db
            db.query.return_value.filter.return_value.first.return_value = user

            deliver_user_notification(
                42,
                "test_event",
                {"title": "Test", "body": "Body"},
                "Subject",
                "Body text",
            )

        mock_email.assert_not_called()

    @unittest.skipUnless(HAS_NOTIFICATION_TASKS, "celery not installed")
    @patch("app.tasks.notification_tasks.send_notification_email")
    def test_deliver_sends_email_when_enabled(self, mock_email):
        mock_email.return_value = True
        db = MagicMock()
        user = MagicMock()
        user.notify_push_enabled = False
        user.notify_email_enabled = True
        user.email = "buyer@example.com"

        with patch("app.tasks.notification_tasks.SessionLocal") as mock_session_local:
            mock_session_local.return_value = db
            db.query.return_value.filter.return_value.first.return_value = user

            deliver_user_notification(
                42,
                "test_event",
                None,
                "Subject",
                "Body text",
            )

        mock_email.assert_called_once_with("buyer@example.com", "Subject", "Body text")


if __name__ == "__main__":
    unittest.main()
