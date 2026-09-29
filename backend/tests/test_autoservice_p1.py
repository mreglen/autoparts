import unittest
from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import app.models  # noqa: F401
from fastapi import HTTPException

from app.schemas.repair_order import RepairOrderWorkExecutorIn, RepairOrderWorkIn
from app.services import autoservice_notifications as notifications
from app.services.autoservice_payroll import accrue_order_payroll
from app.services.notification_service import (
    CATEGORY_AUTOSERVICE,
    EVENT_AUTOSERVICE_BOOKING_CANCELLED_STAFF,
    EVENT_AUTOSERVICE_BOOKING_CONFIRMED,
    EVENT_AUTOSERVICE_BOOKING_REMINDER,
    event_category,
)


class PermissionFilteredRecipientsTests(unittest.TestCase):
    def test_recipients_filtered_by_permission(self):
        db = MagicMock()
        org = MagicMock(is_autoservice=True, autoservice_paused=False)
        users = [MagicMock(id=1), MagicMock(id=2), MagicMock(id=3)]
        db.query.return_value.filter.return_value.first.return_value = org
        db.query.return_value.filter.return_value.all.return_value = users

        with patch.object(
            notifications, "user_is_autoservice_staff", return_value=True
        ), patch.object(
            notifications,
            "has_autoservice_permission",
            side_effect=lambda _db, user, code: user.id != 3,
        ):
            ids = notifications.get_autoservice_staff_recipient_user_ids(
                db, "ORG1", permission="autoservice.inspections"
            )
        self.assertEqual(ids, [1, 2])

    def test_no_permission_filter_keeps_all_staff(self):
        db = MagicMock()
        org = MagicMock(is_autoservice=True, autoservice_paused=False)
        users = [MagicMock(id=1), MagicMock(id=2)]
        db.query.return_value.filter.return_value.first.return_value = org
        db.query.return_value.filter.return_value.all.return_value = users

        with patch.object(
            notifications, "user_is_autoservice_staff", return_value=True
        ):
            ids = notifications.get_autoservice_staff_recipient_user_ids(db, "ORG1")
        self.assertEqual(ids, [1, 2])


class ClientBookingNotificationTests(unittest.TestCase):
    def _booking(self, **overrides):
        base = SimpleNamespace(
            id=5,
            organization_id="ORG1",
            client_id=10,
            created_by_user_id=42,
            name="Иван",
            phone="+79990001122",
            preferred_date=date(2026, 8, 20),
            preferred_time=None,
            status="new",
            source="client",
            vehicle=None,
            organization=SimpleNamespace(name="Сервис Плюс"),
        )
        for key, value in overrides.items():
            setattr(base, key, value)
        return base

    def test_event_category_mapping(self):
        self.assertEqual(
            event_category(EVENT_AUTOSERVICE_BOOKING_CONFIRMED), CATEGORY_AUTOSERVICE
        )
        self.assertEqual(
            event_category(EVENT_AUTOSERVICE_BOOKING_CANCELLED_STAFF),
            CATEGORY_AUTOSERVICE,
        )
        self.assertEqual(
            event_category(EVENT_AUTOSERVICE_BOOKING_REMINDER), CATEGORY_AUTOSERVICE
        )

    def test_notify_client_confirmed_dispatches_to_client_user(self):
        db = MagicMock()
        booking = self._booking()
        client = MagicMock(user_id=77)
        db.query.return_value.filter.return_value.first.return_value = client

        with patch.object(
            notifications, "dispatch_user_notification"
        ) as mock_dispatch:
            notifications.notify_inspection_booking_client(db, booking, "confirmed")

        dispatched = {call.args[0] for call in mock_dispatch.call_args_list}
        self.assertEqual(dispatched, {42, 77})
        kwargs = mock_dispatch.call_args_list[0].kwargs
        self.assertEqual(kwargs["event_type"], EVENT_AUTOSERVICE_BOOKING_CONFIRMED)
        self.assertIn("подтверждена", kwargs["email_subject"])

    def test_notify_client_no_recipients_no_dispatch(self):
        db = MagicMock()
        booking = self._booking(client_id=None, created_by_user_id=None)

        with patch.object(
            notifications, "dispatch_user_notification"
        ) as mock_dispatch:
            notifications.notify_inspection_booking_client(db, booking, "confirmed")

        mock_dispatch.assert_not_called()

    def test_cancel_by_client_notifies_staff_with_permission(self):
        db = MagicMock()
        booking = self._booking()

        with patch.object(
            notifications, "dispatch_org_autoservice_notification"
        ) as mock_dispatch:
            notifications.notify_booking_cancelled_by_client(db, booking)

        kwargs = mock_dispatch.call_args.kwargs
        self.assertEqual(
            kwargs["event_type"], EVENT_AUTOSERVICE_BOOKING_CANCELLED_STAFF
        )
        self.assertEqual(kwargs["permission"], "autoservice.inspections")

    def test_booking_reminder_idempotent(self):
        db = MagicMock()
        booking = self._booking()

        with patch.object(
            notifications, "_booking_reminder_sent", return_value=True
        ), patch.object(
            notifications, "dispatch_user_notification"
        ) as mock_dispatch:
            sent = notifications.send_booking_reminder(db, booking)

        self.assertFalse(sent)
        mock_dispatch.assert_not_called()

    def test_booking_reminder_marks_digest_log(self):
        db = MagicMock()
        booking = self._booking()
        client = MagicMock(user_id=77)
        db.query.return_value.filter.return_value.first.return_value = client

        with patch.object(
            notifications, "_booking_reminder_sent", return_value=False
        ), patch.object(
            notifications, "_mark_booking_reminder_sent"
        ) as mock_mark, patch.object(
            notifications, "dispatch_user_notification"
        ) as mock_dispatch:
            sent = notifications.send_booking_reminder(db, booking)

        self.assertTrue(sent)
        self.assertEqual(mock_dispatch.call_count, 2)
        mock_mark.assert_called_once_with(db, booking)
        kwargs = mock_dispatch.call_args_list[0].kwargs
        self.assertEqual(kwargs["event_type"], EVENT_AUTOSERVICE_BOOKING_REMINDER)


class WorkExecutorPercentLimitTests(unittest.TestCase):
    def test_sum_over_100_rejected(self):
        from app.routers.autoservice_repair_orders import _replace_works

        db = MagicMock()
        order = MagicMock()
        order.works = MagicMock()
        item = RepairOrderWorkIn(
            title="Замена масла",
            qty=1,
            unit_price=Decimal("1000"),
            executors=[
                RepairOrderWorkExecutorIn(employee_id=1, percent=Decimal("60")),
                RepairOrderWorkExecutorIn(employee_id=2, percent=Decimal("60")),
            ],
        )
        with self.assertRaises(HTTPException) as ctx:
            _replace_works(db, order, "ORG1", [item])
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("100", ctx.exception.detail)

    def test_sum_100_allowed(self):
        from app.routers.autoservice_repair_orders import _replace_works

        db = MagicMock()
        order = MagicMock()
        order.works = MagicMock()
        item = RepairOrderWorkIn(
            title="Замена масла",
            qty=1,
            unit_price=Decimal("1000"),
            executors=[
                RepairOrderWorkExecutorIn(employee_id=1, percent=Decimal("60")),
                RepairOrderWorkExecutorIn(employee_id=2, percent=Decimal("40")),
            ],
        )
        with patch(
            "app.routers.autoservice_repair_orders._resolve_catalog_work",
            return_value=(None, "Замена масла", Decimal("1000")),
        ), patch(
            "app.routers.autoservice_repair_orders._resolve_executor",
        ), patch(
            "app.routers.autoservice_repair_orders._resolve_work_executors",
            return_value=[(MagicMock(id=1), Decimal("60")), (MagicMock(id=2), Decimal("40"))],
        ):
            _replace_works(db, order, "ORG1", [item])
        order.works.append.assert_called()


class PayrollEmployeeIdTests(unittest.TestCase):
    def test_executor_without_employee_id_skipped(self):
        db = MagicMock()
        order = SimpleNamespace(
            id=9,
            organization_id="ORG1",
            works=[
                SimpleNamespace(
                    id=1,
                    position=1,
                    title="Работа",
                    qty=1,
                    unit_price=Decimal("1000"),
                    executors=[
                        SimpleNamespace(id=100, employee_id=None, percent=Decimal("50")),
                        SimpleNamespace(id=101, employee_id=5, percent=Decimal("50")),
                    ],
                )
            ],
        )

        accrue_order_payroll(db, order)

        added = [call.args[0] for call in db.add.call_args_list]
        self.assertEqual(len(added), 1)
        self.assertEqual(added[0].employee_id, 5)


if __name__ == "__main__":
    unittest.main()
