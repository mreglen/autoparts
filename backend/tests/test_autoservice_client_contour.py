import sys
import types
import unittest
from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

from fastapi import HTTPException

import app.models  # noqa: F401
from app.models.autoservice_client import AutoserviceClient
from app.models.user import User
from app.schemas.repair_order import RepairOrderClientView
from app.utils.autoservice_access import (
    my_active_autoservice_client_cards,
    my_related_autoservice_client_ids,
)
from app.routers import autoservice_repair_orders as orders_router


def _user(user_id: int = 10) -> User:
    user = User()
    user.id = user_id
    user.email = "client@test.ru"
    return user


def _client_card(client_id: int, org_id: str, user_id: int = 10) -> AutoserviceClient:
    client = AutoserviceClient()
    client.id = client_id
    client.organization_id = org_id
    client.user_id = user_id
    client.status = "active"
    return client


class MyActiveAutoserviceClientCardsTests(unittest.TestCase):
    def test_returns_cards_from_query(self):
        db = MagicMock()
        cards = [_client_card(1, "org-a"), _client_card(2, "org-b")]
        db.query.return_value.join.return_value.filter.return_value.order_by.return_value.all.return_value = cards

        with patch(
            "app.utils.autoservice_access.autoservice_enabled", return_value=True
        ):
            result = my_active_autoservice_client_cards(db, _user())

        self.assertEqual(result, cards)


class MyRelatedAutoserviceClientIdsTests(unittest.TestCase):
    def test_unions_related_ids_across_cards(self):
        user = _user()
        cards = [_client_card(1, "org-a"), _client_card(2, "org-b")]

        def fake_related(_db, client, *, include_phone_matches):
            self.assertFalse(include_phone_matches)
            return {client.id, client.id + 100}

        with patch(
            "app.utils.autoservice_access.my_active_autoservice_client_cards",
            return_value=cards,
        ), patch(
            "app.utils.autoservice_access.related_autoservice_client_ids",
            side_effect=fake_related,
        ):
            ids = my_related_autoservice_client_ids(MagicMock(), user)

        self.assertEqual(ids, {1, 101, 2, 102})

    def test_empty_when_no_cards(self):
        with patch(
            "app.utils.autoservice_access.my_active_autoservice_client_cards",
            return_value=[],
        ):
            self.assertEqual(my_related_autoservice_client_ids(MagicMock(), _user()), set())


class MyRepairOrderClientResolverTests(unittest.TestCase):
    def test_org_param_uses_org_scoped_client(self):
        card = _client_card(7, "org-b")
        with patch.object(
            orders_router, "my_active_autoservice_client", return_value=card
        ) as scoped, patch.object(
            orders_router, "require_my_active_autoservice_client"
        ) as default:
            result = orders_router._my_repair_order_client(
                MagicMock(), _user(), "org-b"
            )

        self.assertIs(result, card)
        scoped.assert_called_once()
        self.assertEqual(scoped.call_args.args[2], "org-b")
        default.assert_not_called()

    def test_org_param_without_card_raises_403(self):
        with patch.object(
            orders_router, "my_active_autoservice_client", return_value=None
        ):
            with self.assertRaises(HTTPException) as ctx:
                orders_router._my_repair_order_client(MagicMock(), _user(), "org-x")

        self.assertEqual(ctx.exception.status_code, 403)

    def test_no_org_param_uses_default_org_client(self):
        card = _client_card(3, "org-a")
        with patch.object(
            orders_router, "require_my_active_autoservice_client", return_value=card
        ) as default, patch.object(
            orders_router, "my_active_autoservice_client"
        ) as scoped:
            result = orders_router._my_repair_order_client(MagicMock(), _user(), None)

        self.assertIs(result, card)
        default.assert_called_once()
        scoped.assert_not_called()


class GetMyRepairOrderOr404Tests(unittest.TestCase):
    def test_no_client_cards_raises_403(self):
        with patch.object(
            orders_router, "my_related_autoservice_client_ids", return_value=set()
        ):
            with self.assertRaises(HTTPException) as ctx:
                orders_router._get_my_repair_order_or_404(MagicMock(), 1, _user())

        self.assertEqual(ctx.exception.status_code, 403)

    def test_order_from_other_org_is_visible(self):
        row = SimpleNamespace(id=42)
        query = MagicMock()
        query.filter.return_value.first.return_value = row
        with patch.object(
            orders_router, "my_related_autoservice_client_ids", return_value={5, 9}
        ), patch.object(orders_router, "_order_query", return_value=query):
            result = orders_router._get_my_repair_order_or_404(MagicMock(), 42, _user())

        self.assertIs(result, row)

    def test_foreign_order_raises_404(self):
        query = MagicMock()
        query.filter.return_value.first.return_value = None
        with patch.object(
            orders_router, "my_related_autoservice_client_ids", return_value={5}
        ), patch.object(orders_router, "_order_query", return_value=query):
            with self.assertRaises(HTTPException) as ctx:
                orders_router._get_my_repair_order_or_404(MagicMock(), 42, _user())

        self.assertEqual(ctx.exception.status_code, 404)


class ToClientViewOrgFieldsTests(unittest.TestCase):
    def _row(self):
        return SimpleNamespace(
            id=1,
            order_number="15",
            organization_id="org-b",
            organization=SimpleNamespace(name="СТО Уют"),
            vehicle_id=None,
            client_comment=None,
            work_zone_id=None,
            work_zone=None,
            scheduled_at=datetime(2026, 11, 1, 10, 0),
            scheduled_end_at=None,
            status="in_progress",
            created_at=datetime(2026, 10, 30, 9, 0),
            vehicle=None,
            works=[],
            client_parts=[],
            shop_parts=[],
            deliveries=[],
            vat_rate=Decimal("22"),
            discount_percent=Decimal("0"),
        )

    def test_client_view_contains_organization_fields(self):
        view = orders_router._to_client_view(self._row())

        self.assertIsInstance(view, RepairOrderClientView)
        self.assertEqual(view.organization_id, "org-b")
        self.assertEqual(view.organization_name, "СТО Уют")

    def test_client_view_handles_missing_organization(self):
        row = self._row()
        row.organization = None
        view = orders_router._to_client_view(row)

        self.assertEqual(view.organization_id, "org-b")
        self.assertIsNone(view.organization_name)


if __name__ == "__main__":
    unittest.main()
