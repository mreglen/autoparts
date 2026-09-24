import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

import app.models  # noqa: F401
import app.models.autoservice_client  # noqa: F401
from app.models.autoservice_client import AutoserviceClient
from app.models.user import User
from app.schemas.autoservice_client import AutoserviceClientLinkAccountIn
from app.utils.autoservice_access import (
    find_active_autoservice_client_for_user,
    get_or_create_autoservice_client_for_user,
    related_autoservice_client_ids,
)
from app.routers.autoservice_clients import (
    link_autoservice_client_account,
    list_autoservice_client_account_candidates,
)
from app.routers.autoservice_repair_orders import (
    update_manual_repair_order_shop_part,
    update_repair_order,
)


def _user(user_id: int = 10, phone: str = "+79990001122") -> User:
    user = User()
    user.id = user_id
    user.phone = phone
    user.email = "client@test.ru"
    user.first_name = "Ivan"
    user.last_name = "Petrov"
    user.patronymic = None
    return user


def _client(client_id: int = 1, user_id=None, phone: str = "+79990001122") -> AutoserviceClient:
    client = AutoserviceClient()
    client.id = client_id
    client.organization_id = "org-auto"
    client.user_id = user_id
    client.phone = phone
    client.status = "active"
    client.name = "Ivan Petrov"
    return client


class FindActiveClientTests(unittest.TestCase):
    def test_returns_only_user_id_match_no_phone_autolink(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        user = _user()

        result = find_active_autoservice_client_for_user(db, user, "org-auto")

        self.assertIsNone(result)
        db.query.assert_called_once()
        db.commit.assert_not_called()

    def test_returns_linked_card(self):
        db = MagicMock()
        card = _client(user_id=10)
        db.query.return_value.filter.return_value.first.return_value = card

        result = find_active_autoservice_client_for_user(db, _user(), "org-auto")

        self.assertIs(result, card)


class GetOrCreateClientTests(unittest.TestCase):
    def test_guest_card_with_same_phone_is_not_linked(self):
        db = MagicMock()
        guest = _client(client_id=5, user_id=None)
        db.query.return_value.filter.return_value.first.side_effect = [None, guest]
        user = _user(user_id=77)

        with self.assertRaises(HTTPException) as ctx:
            get_or_create_autoservice_client_for_user(db, user, "org-auto")

        self.assertEqual(ctx.exception.status_code, 409)
        self.assertIsNone(guest.user_id)
        db.flush.assert_not_called()

    def test_foreign_card_with_same_phone_conflicts(self):
        db = MagicMock()
        foreign = _client(client_id=6, user_id=999)
        db.query.return_value.filter.return_value.first.side_effect = [None, foreign]

        with self.assertRaises(HTTPException) as ctx:
            get_or_create_autoservice_client_for_user(db, _user(), "org-auto")

        self.assertEqual(ctx.exception.status_code, 409)


class RelatedClientIdsTests(unittest.TestCase):
    def test_phone_merge_skipped_for_own_views(self):
        db = MagicMock()
        client = _client(client_id=3, user_id=10)
        db.query.return_value.filter.return_value.all.return_value = [(3,), (8,)]

        ids = related_autoservice_client_ids(db, client, include_phone_matches=False)

        self.assertEqual(ids, [3, 8])
        # Только запрос по user_id, телефонные сканы не выполняются
        self.assertEqual(db.query.call_count, 1)

    def test_staff_view_keeps_phone_merge(self):
        db = MagicMock()
        client = _client(client_id=3, user_id=None)

        def _query(*cols):
            q = MagicMock()
            if len(cols) > 1:
                q.filter.return_value.all.return_value = [(3, client.phone), (9, "+7 999 000-11-23")]
            else:
                q.filter.return_value.all.return_value = [(3,)]
            return q

        db.query.side_effect = _query

        ids = related_autoservice_client_ids(db, client)

        self.assertEqual(ids, [3])
        self.assertGreater(db.query.call_count, 1)


class LinkAccountEndpointTests(unittest.TestCase):
    def _call(self, db, client, user_id=42):
        payload = AutoserviceClientLinkAccountIn(user_id=user_id)
        with patch(
            "app.routers.autoservice_clients.require_autoservice_permission",
            return_value="org-auto",
        ), patch(
            "app.routers.autoservice_clients._get_org_client_or_404",
            return_value=client,
        ):
            return link_autoservice_client_account(
                client.id, payload, db=db, current_user=MagicMock()
            )

    def test_link_success(self):
        db = MagicMock()
        client = _client(user_id=None)
        user = _user(user_id=42)
        db.query.return_value.filter.return_value.first.return_value = user

        with patch(
            "app.routers.autoservice_clients._find_by_user", return_value=None
        ), patch(
            "app.routers.autoservice_clients._client_view_with_account_email",
            side_effect=lambda _db, row: row,
        ):
            result = self._call(db, client)

        self.assertEqual(client.user_id, 42)
        db.commit.assert_called_once()
        self.assertIs(result, client)

    def test_link_rejects_already_linked_client(self):
        db = MagicMock()
        client = _client(user_id=11)

        with self.assertRaises(HTTPException) as ctx:
            self._call(db, client)

        self.assertEqual(ctx.exception.status_code, 400)

    def test_link_404_when_user_missing(self):
        db = MagicMock()
        client = _client(user_id=None)
        db.query.return_value.filter.return_value.first.return_value = None

        with self.assertRaises(HTTPException) as ctx:
            self._call(db, client)

        self.assertEqual(ctx.exception.status_code, 404)

    def test_link_409_when_user_has_card(self):
        db = MagicMock()
        client = _client(user_id=None)
        user = _user(user_id=42)
        db.query.return_value.filter.return_value.first.return_value = user

        with patch(
            "app.routers.autoservice_clients._find_by_user",
            return_value=_client(client_id=9, user_id=42),
        ):
            with self.assertRaises(HTTPException) as ctx:
                self._call(db, client)

        self.assertEqual(ctx.exception.status_code, 409)


class ClosedOrderGuardTests(unittest.TestCase):
    def test_update_repair_order_rejects_completed(self):
        db = MagicMock()
        order = MagicMock()
        order.status = "completed"
        payload = MagicMock()
        payload.model_fields_set = set()

        with patch(
            "app.routers.autoservice_repair_orders.require_orders_access",
            return_value=("org-auto", "full"),
        ), patch(
            "app.routers.autoservice_repair_orders._get_visible_order_or_404",
            return_value=order,
        ):
            with self.assertRaises(HTTPException) as ctx:
                update_repair_order(1, payload, db=db, current_user=MagicMock())

        self.assertEqual(ctx.exception.status_code, 400)

    def test_update_repair_order_rejects_cancelled(self):
        db = MagicMock()
        order = MagicMock()
        order.status = "cancelled"
        payload = MagicMock()
        payload.model_fields_set = set()

        with patch(
            "app.routers.autoservice_repair_orders.require_orders_access",
            return_value=("org-auto", "full"),
        ), patch(
            "app.routers.autoservice_repair_orders._get_visible_order_or_404",
            return_value=order,
        ):
            with self.assertRaises(HTTPException) as ctx:
                update_repair_order(1, payload, db=db, current_user=MagicMock())

        self.assertEqual(ctx.exception.status_code, 400)

    def test_update_manual_shop_part_rejects_closed_order(self):
        db = MagicMock()
        order = MagicMock()
        order.status = "completed"

        with patch(
            "app.routers.autoservice_repair_orders._require_full_orders",
            return_value="org-auto",
        ), patch(
            "app.routers.autoservice_repair_orders._get_org_order_or_404",
            return_value=order,
        ):
            with self.assertRaises(HTTPException) as ctx:
                update_manual_repair_order_shop_part(
                    1, 2, MagicMock(), db=db, current_user=MagicMock()
                )

        self.assertEqual(ctx.exception.status_code, 400)


class ShortcutEndpointsRemovedTests(unittest.TestCase):
    def test_shortcut_routes_removed(self):
        from app.routers import autoservice_inspections, autoservice_planner

        planner_paths = {route.path for route in autoservice_planner.router.routes}
        inspection_paths = {route.path for route in autoservice_inspections.router.routes}

        self.assertNotIn("/autoservice/planner/shortcuts/today", planner_paths)
        self.assertNotIn("/autoservice/inspection-bookings/shortcut", inspection_paths)


if __name__ == "__main__":
    unittest.main()
