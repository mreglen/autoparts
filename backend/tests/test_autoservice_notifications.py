import unittest
from datetime import date, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import app.models  # noqa: F401

from app.models.autoservice_digest_log import AutoserviceDigestLog
from app.services.autoservice_notifications import (
    DIGEST_KIND_PLANNER_DAILY,
    build_planner_digest_for_org,
    get_autoservice_staff_recipient_user_ids,
    notify_new_inspection_booking,
    send_daily_planner_digest_for_org,
    user_is_autoservice_staff,
)
from app.services.notification_service import (
    CATEGORY_AUTOSERVICE,
    EVENT_AUTOSERVICE_NEW_INSPECTION,
    EVENT_AUTOSERVICE_PLANNER_DAILY,
    event_category,
)


class AutoserviceStaffRecipientTests(unittest.TestCase):
    def test_user_is_autoservice_staff(self):
        director = MagicMock(is_director=True, is_seller=False, is_employee=False)
        seller = MagicMock(is_director=False, is_seller=True, is_employee=False)
        employee = MagicMock(is_director=False, is_seller=False, is_employee=True)
        client = MagicMock(is_director=False, is_seller=False, is_employee=False)
        self.assertTrue(user_is_autoservice_staff(director))
        self.assertTrue(user_is_autoservice_staff(seller))
        self.assertTrue(user_is_autoservice_staff(employee))
        self.assertFalse(user_is_autoservice_staff(client))

    def test_recipient_helpers_filter_staff_and_active_org(self):
        db = MagicMock()
        org = MagicMock(is_autoservice=True, autoservice_paused=False)
        director = MagicMock(id=1)
        seller = MagicMock(id=2)
        employee = MagicMock(id=3)
        outsider = MagicMock(id=4)
        db.query.return_value.filter.return_value.first.return_value = org
        db.query.return_value.filter.return_value.all.return_value = [
            director,
            seller,
            employee,
            outsider,
        ]

        with patch(
            "app.services.autoservice_notifications.user_is_autoservice_staff",
            side_effect=lambda user: user.id in (1, 2, 3),
        ):
            self.assertEqual(get_autoservice_staff_recipient_user_ids(db, "ORG1"), [1, 2, 3])

    def test_paused_org_returns_no_recipients(self):
        db = MagicMock()
        org = MagicMock(is_autoservice=True, autoservice_paused=True)
        db.query.return_value.filter.return_value.first.return_value = org
        self.assertEqual(get_autoservice_staff_recipient_user_ids(db, "ORG1"), [])


class AutoserviceEventCategoryTests(unittest.TestCase):
    def test_event_category_mapping(self):
        self.assertEqual(event_category(EVENT_AUTOSERVICE_PLANNER_DAILY), CATEGORY_AUTOSERVICE)
        self.assertEqual(event_category(EVENT_AUTOSERVICE_NEW_INSPECTION), CATEGORY_AUTOSERVICE)


class AutoservicePlannerDigestQueryTests(unittest.TestCase):
    def _sample_order(self, order_id, order_number, hour, minute, status="pending"):
        return SimpleNamespace(
            id=order_id,
            order_number=order_number,
            scheduled_at=datetime(2026, 8, 13, hour, minute, 0),
            status=status,
            client=SimpleNamespace(name="Иванов И."),
            vehicle=SimpleNamespace(make="Toyota", model="Camry", plate="А123БВ"),
            work_zone=SimpleNamespace(name="Подъёмник 1"),
        )

    @patch("app.services.autoservice_notifications.fetch_planner_orders_for_day")
    def test_build_planner_digest_returns_none_when_empty(self, mock_fetch):
        db = MagicMock()
        mock_fetch.return_value = []
        self.assertIsNone(build_planner_digest_for_org(db, "ORG2", date(2026, 8, 13)))

    @patch("app.services.autoservice_notifications.fetch_planner_orders_for_day")
    def test_build_planner_digest_contains_orders(self, mock_fetch):
        db = MagicMock()
        mock_fetch.return_value = [
            self._sample_order(1, "101", 9, 0),
            self._sample_order(2, "102", 11, 30),
        ]
        digest = build_planner_digest_for_org(db, "ORG1", date(2026, 8, 13))
        self.assertIsNotNone(digest)
        title, push_body, email_body = digest
        self.assertIn("13.08.2026", title)
        self.assertIn("2 записи", title)
        self.assertIn("ЗН-101", email_body)
        self.assertIn("ЗН-102", email_body)
        self.assertIn("2 записи", push_body)

    @patch("app.services.autoservice_notifications.fetch_planner_orders_for_day")
    def test_fetch_planner_orders_excludes_cancelled_and_other_days(self, mock_fetch):
        db = MagicMock()
        mock_fetch.return_value = [
            self._sample_order(1, "101", 9, 0),
            self._sample_order(2, "102", 11, 30),
        ]
        orders = mock_fetch(db, "ORG1", date(2026, 8, 13))
        self.assertEqual([order.id for order in orders], [1, 2])


class AutoserviceNotificationDispatchTests(unittest.TestCase):
    @patch("app.services.autoservice_notifications.dispatch_org_autoservice_notification")
    def test_notify_new_inspection_booking_site(self, mock_dispatch):
        db = MagicMock()
        booking = SimpleNamespace(
            id=5,
            organization_id="ORG1",
            name="Иван",
            phone="+79990001122",
            preferred_date=date(2026, 8, 20),
            status="new",
            source="site",
            vehicle=None,
        )
        notify_new_inspection_booking(db, booking)
        mock_dispatch.assert_called_once()
        kwargs = mock_dispatch.call_args.kwargs
        self.assertEqual(kwargs["event_type"], EVENT_AUTOSERVICE_NEW_INSPECTION)
        self.assertEqual(kwargs["push_data"]["type"], "autoservice_inspection")

    @patch("app.services.autoservice_notifications.dispatch_org_autoservice_notification")
    def test_notify_new_inspection_booking_skips_staff(self, mock_dispatch):
        db = MagicMock()
        booking = SimpleNamespace(
            id=6,
            organization_id="ORG1",
            name="Пётр",
            phone="+79990001123",
            preferred_date=date(2026, 8, 21),
            status="new",
            source="staff",
            vehicle=None,
        )
        notify_new_inspection_booking(db, booking)
        mock_dispatch.assert_not_called()

    @patch("app.services.autoservice_notifications._mark_digest_sent")
    @patch("app.services.autoservice_notifications.dispatch_org_autoservice_notification")
    @patch("app.services.autoservice_notifications.build_planner_digest_for_org")
    @patch("app.services.autoservice_notifications._digest_already_sent")
    def test_send_daily_digest_idempotent(
        self,
        mock_already_sent,
        mock_build,
        mock_dispatch,
        mock_mark_sent,
    ):
        db = MagicMock()
        mock_already_sent.return_value = True
        sent = send_daily_planner_digest_for_org(db, "ORG1", date(2026, 8, 13))
        self.assertFalse(sent)
        mock_build.assert_not_called()
        mock_dispatch.assert_not_called()
        mock_mark_sent.assert_not_called()

    @patch("app.services.autoservice_notifications._mark_digest_sent")
    @patch("app.services.autoservice_notifications.dispatch_org_autoservice_notification")
    @patch("app.services.autoservice_notifications.build_planner_digest_for_org")
    @patch("app.services.autoservice_notifications._digest_already_sent")
    def test_send_daily_digest_marks_sent_after_dispatch(
        self,
        mock_already_sent,
        mock_build,
        mock_dispatch,
        mock_mark_sent,
    ):
        db = MagicMock()
        mock_already_sent.return_value = False
        mock_build.return_value = ("Title", "Body", "Email body")
        sent = send_daily_planner_digest_for_org(db, "ORG1", date(2026, 8, 13))
        self.assertTrue(sent)
        mock_dispatch.assert_called_once()
        kwargs = mock_dispatch.call_args.kwargs
        self.assertEqual(kwargs["event_type"], EVENT_AUTOSERVICE_PLANNER_DAILY)
        mock_mark_sent.assert_called_once_with(db, "ORG1", date(2026, 8, 13), DIGEST_KIND_PLANNER_DAILY)


class AutoserviceDigestLogModelTests(unittest.TestCase):
    def test_unique_constraint_name(self):
        names = {constraint.name for constraint in AutoserviceDigestLog.__table__.constraints}
        self.assertIn("uq_autoservice_digest_log_org_date_kind", names)


if __name__ == "__main__":
    unittest.main()
