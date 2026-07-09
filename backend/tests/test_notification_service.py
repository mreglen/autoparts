import unittest
from unittest.mock import MagicMock, patch

from app.services.notification_service import (
    CATEGORY_MESSAGES,
    CATEGORY_ORDERS,
    CATEGORY_OTHER,
    CATEGORY_SEARCH,
    EVENT_AVITO_MESSENGER,
    EVENT_CHAT_MESSAGE,
    EVENT_NEW_ORDER_SELLER,
    EVENT_ORDER_STATUS_BUYER,
    EVENT_SEARCH_SUBSCRIPTION_MATCH,
    EVENT_STOCK_LOW,
    DEFAULT_NOTIFICATION_PREFS,
    dispatch_user_notification,
    event_category,
    get_user_notification_prefs,
    maybe_notify_stock_level,
    merge_notification_prefs_patch,
    normalize_notification_prefs,
    notification_prefs_from_legacy,
    order_status_label,
    should_send_email_for_event,
    should_send_push_for_event,
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

    def test_event_category_mapping(self):
        self.assertEqual(event_category(EVENT_NEW_ORDER_SELLER), CATEGORY_ORDERS)
        self.assertEqual(event_category(EVENT_ORDER_STATUS_BUYER), CATEGORY_ORDERS)
        self.assertEqual(event_category(EVENT_CHAT_MESSAGE), CATEGORY_MESSAGES)
        self.assertEqual(event_category(EVENT_AVITO_MESSENGER), CATEGORY_MESSAGES)
        self.assertEqual(event_category(EVENT_SEARCH_SUBSCRIPTION_MATCH), CATEGORY_SEARCH)
        self.assertEqual(event_category(EVENT_STOCK_LOW), CATEGORY_OTHER)

    def test_notification_prefs_from_legacy(self):
        user = MagicMock()
        user.notify_push_enabled = False
        user.notify_email_enabled = True
        prefs = notification_prefs_from_legacy(user)
        self.assertFalse(prefs["orders"]["push"])
        self.assertTrue(prefs["orders"]["email"])
        self.assertFalse(prefs["messages"]["push"])

    def test_normalize_notification_prefs_partial_patch(self):
        prefs = normalize_notification_prefs(
            {"orders": {"push": False}},
            user=None,
        )
        self.assertFalse(prefs["orders"]["push"])
        self.assertTrue(prefs["orders"]["email"])
        self.assertTrue(prefs["messages"]["push"])

    def test_merge_notification_prefs_patch(self):
        current = normalize_notification_prefs(DEFAULT_NOTIFICATION_PREFS)
        merged = merge_notification_prefs_patch(
            current,
            {"search": {"email": False}},
        )
        self.assertFalse(merged["search"]["email"])
        self.assertTrue(merged["search"]["push"])

    def test_should_send_respects_category_prefs(self):
        user = MagicMock()
        user.notification_prefs = {
            "orders": {"push": False, "email": True},
            "messages": {"push": True, "email": False},
            "search": {"push": True, "email": True},
            "other": {"push": True, "email": True},
        }
        user.notify_push_enabled = True
        user.notify_email_enabled = True

        self.assertFalse(should_send_push_for_event(user, EVENT_NEW_ORDER_SELLER))
        self.assertTrue(should_send_email_for_event(user, EVENT_NEW_ORDER_SELLER))
        self.assertTrue(should_send_push_for_event(user, EVENT_CHAT_MESSAGE))
        self.assertFalse(should_send_email_for_event(user, EVENT_CHAT_MESSAGE))

    def test_get_user_notification_prefs_falls_back_to_legacy(self):
        user = MagicMock()
        user.notification_prefs = None
        user.notify_push_enabled = False
        user.notify_email_enabled = False
        prefs = get_user_notification_prefs(user)
        self.assertFalse(prefs["other"]["push"])
        self.assertFalse(prefs["other"]["email"])

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
    @patch("app.routers.notifications.send_push_notification")
    def test_deliver_respects_disabled_category(self, mock_push, mock_email):
        mock_email.return_value = True
        db = MagicMock()
        user = MagicMock()
        user.notification_prefs = {
            "orders": {"push": False, "email": False},
            "messages": {"push": True, "email": True},
            "search": {"push": True, "email": True},
            "other": {"push": True, "email": True},
        }
        user.notify_push_enabled = True
        user.notify_email_enabled = True
        user.email = "buyer@example.com"

        with patch("app.tasks.notification_tasks.SessionLocal") as mock_session_local:
            mock_session_local.return_value = db
            db.query.return_value.filter.return_value.first.side_effect = [
                user,
                MagicMock(),
            ]

            deliver_user_notification(
                42,
                EVENT_NEW_ORDER_SELLER,
                {"title": "Test", "body": "Body"},
                "Subject",
                "Body text",
            )

        mock_push.assert_not_called()
        mock_email.assert_not_called()

    @unittest.skipUnless(HAS_NOTIFICATION_TASKS, "celery not installed")
    @patch("app.tasks.notification_tasks.send_notification_email")
    def test_deliver_sends_email_when_category_enabled(self, mock_email):
        mock_email.return_value = True
        db = MagicMock()
        user = MagicMock()
        user.notification_prefs = normalize_notification_prefs(None)
        user.notify_push_enabled = True
        user.notify_email_enabled = True
        user.email = "buyer@example.com"

        with patch("app.tasks.notification_tasks.SessionLocal") as mock_session_local:
            mock_session_local.return_value = db
            db.query.return_value.filter.return_value.first.return_value = user

            deliver_user_notification(
                42,
                EVENT_ORDER_STATUS_BUYER,
                None,
                "Subject",
                "Body text",
            )

        mock_email.assert_called_once_with("buyer@example.com", "Subject", "Body text")


if __name__ == "__main__":
    unittest.main()
