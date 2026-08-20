"""Tests for autoservice employee flag on unified org employee cards."""

from decimal import Decimal
from unittest import TestCase
from unittest.mock import MagicMock

from app.services.organization_employee_sync import (
    link_service_employee_card,
    service_employee_is_executor,
    sync_user_service_executor,
)


class OrganizationEmployeeServiceExecutorTests(TestCase):
    def test_link_service_employee_card_marks_executor(self):
        db = MagicMock()
        service_employee = MagicMock(
            id=7,
            organization_id="ORG001",
            name="Иван Мастер",
            phone="+7 (999) 111-22-33",
            position="Механик",
            salary_type="percent_work",
            salary_amount=Decimal("0"),
            work_percent=Decimal("30"),
            is_active=True,
        )
        db.query.return_value.filter.return_value.first.return_value = None

        card = link_service_employee_card(db, service_employee)

        self.assertTrue(card.is_service_executor)
        self.assertEqual(card.legacy_service_employee_id, 7)
        self.assertGreaterEqual(db.add.call_count, 1)
        db.flush.assert_called()

    def test_service_employee_is_executor_requires_flag(self):
        db = MagicMock()
        card = MagicMock(is_service_executor=True, is_active=True)
        db.query.return_value.filter.return_value.first.return_value = card
        self.assertTrue(service_employee_is_executor(db, 1))

        card.is_service_executor = False
        self.assertFalse(service_employee_is_executor(db, 1))

    def test_sync_user_service_executor_creates_legacy_row(self):
        db = MagicMock()
        user = MagicMock(
            id=3,
            organization_id="ORG001",
            last_name="Петров",
            first_name="Пётр",
            patronymic=None,
            phone="+7 (999) 000-00-00",
            email="petrov@example.com",
        )
        db.query.return_value.filter.return_value.first.side_effect = [None, None]

        card = sync_user_service_executor(db, user, True, work_percent=Decimal("25"))

        self.assertTrue(card.is_service_executor)
        self.assertEqual(db.add.call_count, 2)
        db.flush.assert_called()
