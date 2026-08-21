"""Tests for unified organization employee cards API service."""

import sys
import types
import unittest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

from app.models.autoservice_service_employee import AutoserviceServiceEmployee
from app.models.organization_employee import OrganizationEmployee, OrganizationEmployeePayrollTerm
from app.schemas.organization_employee import OrganizationEmployeeCardCreate
from app.services.organization_employee_service import (
    card_to_view,
    create_employee_account,
    create_employee_card,
    set_card_permissions,
)
from app.services.organization_employee_sync import _ensure_payroll_from_legacy, link_service_employee_card


class OrganizationEmployeeCardServiceTests(unittest.TestCase):
    def _mock_db_for_create(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        def _add(obj):
            if isinstance(obj, OrganizationEmployee) and getattr(obj, "id", None) is None:
                obj.id = 1
            if isinstance(obj, OrganizationEmployeePayrollTerm):
                if getattr(obj, "id", None) is None:
                    obj.id = 1
                for call in db.add.call_args_list:
                    card_obj = call.args[0]
                    if isinstance(card_obj, OrganizationEmployee):
                        card_obj.payroll_terms = [obj]
                        break
            if isinstance(obj, AutoserviceServiceEmployee):
                obj.id = 10
                for call in db.add.call_args_list:
                    card_obj = call.args[0]
                    if isinstance(card_obj, OrganizationEmployee):
                        card_obj.legacy_service_employee_id = obj.id
                        card_obj.legacy_service_employee = obj
                        break

        db.add.side_effect = _add
        return db

    def test_create_card_without_email(self):
        db = self._mock_db_for_create()
        payload = OrganizationEmployeeCardCreate(
            last_name="Сидоров",
            first_name="Сидор",
            email=None,
            phone=None,
            is_service_executor=False,
        )

        view = create_employee_card(db, "ORG001", payload)

        self.assertEqual(view["last_name"], "Сидоров")
        self.assertIsNone(view["email"])
        self.assertEqual(view["account_status"], "no_account")
        self.assertFalse(view["is_service_executor"])

    def test_create_service_executor_defaults_to_50_percent(self):
        db = self._mock_db_for_create()
        payload = OrganizationEmployeeCardCreate(
            last_name="Мастеров",
            first_name="Мастер",
            is_service_executor=True,
            salary_type="percent_work",
            work_percent=Decimal("0"),
        )

        view = create_employee_card(db, "ORG001", payload)

        self.assertTrue(view["is_service_executor"])
        self.assertEqual(view["salary_type"], "percent_work")
        self.assertEqual(view["work_percent"], Decimal("50.00"))

        added_legacy = [
            call.args[0]
            for call in db.add.call_args_list
            if isinstance(call.args[0], AutoserviceServiceEmployee)
        ]
        self.assertEqual(len(added_legacy), 1)
        self.assertEqual(added_legacy[0].work_percent, Decimal("50.00"))

    def test_create_service_executor_fixed_payroll(self):
        db = self._mock_db_for_create()
        payload = OrganizationEmployeeCardCreate(
            last_name="Фикс",
            first_name="Сотрудник",
            is_service_executor=True,
            salary_type="fixed",
            salary_amount=Decimal("45000"),
        )

        view = create_employee_card(db, "ORG001", payload)

        self.assertEqual(view["salary_type"], "fixed")
        self.assertEqual(view["salary_amount"], Decimal("45000.00"))

    def test_create_account_requires_email(self):
        db = MagicMock()
        card = OrganizationEmployee(
            id=1,
            organization_id="ORG001",
            last_name="Без",
            first_name="Почты",
            email=None,
            account_status="no_account",
            is_active=True,
        )
        db.query.return_value.filter.return_value.first.return_value = card

        with self.assertRaises(HTTPException) as ctx:
            create_employee_account(db, "ORG001", 1)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_create_account_conflicts_with_existing_email(self):
        db = MagicMock()
        card = OrganizationEmployee(
            id=1,
            organization_id="ORG001",
            last_name="Новый",
            first_name="Сотрудник",
            email="exists@example.com",
            account_status="no_account",
            is_active=True,
        )
        existing_user = SimpleNamespace(id=99, email="exists@example.com")
        db.query.return_value.filter.return_value.first.side_effect = [card, existing_user]

        with self.assertRaises(HTTPException) as ctx:
            create_employee_account(db, "ORG001", 1)
        self.assertEqual(ctx.exception.status_code, 409)

    @patch("app.services.organization_employee_service.send_employee_account_email", return_value=True)
    @patch("app.services.organization_chat_service.on_user_joined_organization")
    @patch(
        "app.services.organization_employee_service.assign_public_code",
        side_effect=lambda user, db: setattr(user, "public_code", "U000000099") or None,
    )
    def test_create_account_sends_temp_password(self, mock_assign_code, mock_joined, mock_send_email):
        db = MagicMock()
        card = OrganizationEmployee(
            id=1,
            organization_id="ORG001",
            last_name="Почта",
            first_name="Тест",
            email="worker@example.com",
            account_status="no_account",
            is_active=True,
            payroll_terms=[],
        )
        org = SimpleNamespace(name="Test Org")

        def _first():
            calls = [
                card,
                None,
                None,
                org,
            ]
            for item in calls:
                yield item

        first_iter = _first()

        def _query(model):
            query = MagicMock()
            if model.__name__ == "OrganizationEmployeePermission":
                query.filter.return_value.all.return_value = []
            elif model.__name__ == "UserPermission":
                query.filter.return_value.delete.return_value = None
            elif model.__name__ == "UserSession":
                query.filter.return_value.update.return_value = None
            else:
                query.filter.return_value.first.side_effect = lambda: next(first_iter, None)
            return query

        db.query.side_effect = _query

        def _add(obj):
            if getattr(obj, "__tablename__", None) == "users":
                obj.id = 42

        db.add.side_effect = _add

        result = create_employee_account(db, "ORG001", 1)

        self.assertTrue(result["ok"])
        self.assertTrue(result["email_sent"])
        mock_send_email.assert_called_once()
        self.assertEqual(card.user_id, 42)
        self.assertEqual(card.account_status, "linked")


class OrganizationEmployeePayrollBackfillTests(unittest.TestCase):
    def test_ensure_payroll_from_legacy_defaults_percent_to_50(self):
        db = MagicMock()
        card = OrganizationEmployee(
            organization_id="ORG001",
            last_name="",
            first_name="Worker",
            payroll_terms=[],
        )
        legacy = AutoserviceServiceEmployee(
            organization_id="ORG001",
            name="Worker",
            salary_type="percent_work",
            salary_amount=Decimal("0"),
            work_percent=Decimal("0"),
            is_active=True,
        )

        _ensure_payroll_from_legacy(db, card, legacy)

        added = db.add.call_args.args[0]
        self.assertEqual(added.work_percent, Decimal("50"))
        db.add.assert_called_once()

    def test_ensure_payroll_from_legacy_maps_daily_rate_to_percent_work(self):
        db = MagicMock()
        card = OrganizationEmployee(
            organization_id="ORG001",
            last_name="",
            first_name="Worker",
            payroll_terms=[],
        )
        legacy = AutoserviceServiceEmployee(
            organization_id="ORG001",
            name="Worker",
            salary_type="daily_rate",
            salary_amount=Decimal("1500"),
            work_percent=Decimal("0"),
            is_active=True,
        )

        _ensure_payroll_from_legacy(db, card, legacy)

        term = db.add.call_args.args[0]
        self.assertEqual(term.salary_type, "percent_work")
        self.assertEqual(term.work_percent, Decimal("50"))

    def test_link_service_employee_card_marks_executor(self):
        db = MagicMock()
        service_employee = AutoserviceServiceEmployee(
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


class OrganizationEmployeeCardViewTests(unittest.TestCase):
    def test_card_to_view_uses_linked_status_when_user_present(self):
        card = OrganizationEmployee(
            id=1,
            organization_id="ORG001",
            user_id=10,
            last_name="User",
            first_name="Test",
            account_status="no_account",
            is_active=True,
            payroll_terms=[],
        )
        card.user = MagicMock(is_director=False)
        view = card_to_view(MagicMock(), card)
        self.assertEqual(view["account_status"], "linked")


class SetCardPermissionsTests(unittest.TestCase):
    def test_set_card_permissions_copies_payload_to_user_account(self):
        from app.models.user_permission import UserPermission
        from app.models.organization_employee import OrganizationEmployeePermission

        db = MagicMock()
        card = SimpleNamespace(id=7, user_id=42)
        db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(id=1)
        db.query.return_value.filter.return_value.delete.return_value = 0
        db.query.return_value.filter.return_value.update.return_value = 0
        # If the old race is still present, this empty requery would wipe user perms.
        db.query.return_value.filter.return_value.all.return_value = []

        with patch(
            "app.services.organization_employee_service._get_card_or_404",
            return_value=card,
        ):
            set_card_permissions(db, "ORG001", 7, [11, 12, 11])

        added_user_ids = [
            call.args[0].permission_id
            for call in db.add.call_args_list
            if isinstance(call.args[0], UserPermission)
        ]
        added_card_ids = [
            call.args[0].permission_id
            for call in db.add.call_args_list
            if isinstance(call.args[0], OrganizationEmployeePermission)
        ]
        self.assertEqual(added_card_ids, [11, 12])
        self.assertEqual(added_user_ids, [11, 12])


if __name__ == "__main__":
    unittest.main()
