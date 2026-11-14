"""Мульти-СТО для клиентского гаража: organization_id в PATCH/DELETE, decode без привязки к орге."""

import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from app.routers import autoservice_garage as garage
from app.schemas.garage_vehicle import GarageVehicleUpdate


def _user():
    u = MagicMock()
    u.id = 7
    return u


class RequireAnyClientCardTests(unittest.TestCase):
    def test_no_cards_raises_403(self):
        with patch.object(garage, "my_active_autoservice_client_cards", return_value=[]):
            with self.assertRaises(HTTPException) as ctx:
                garage._require_any_client_card(MagicMock(), _user())
        self.assertEqual(ctx.exception.status_code, 403)

    def test_any_card_passes(self):
        with patch.object(garage, "my_active_autoservice_client_cards", return_value=[MagicMock()]):
            garage._require_any_client_card(MagicMock(), _user())


class MyGarageClientTests(unittest.TestCase):
    def test_no_org_uses_default_client(self):
        client = MagicMock()
        with patch.object(garage, "require_my_active_autoservice_client", return_value=client) as m:
            result = garage._my_garage_client(MagicMock(), _user(), None)
        self.assertIs(result, client)
        m.assert_called_once()

    def test_org_resolves_card_in_org(self):
        client = MagicMock()
        with patch.object(garage, "my_active_autoservice_client", return_value=client) as m:
            result = garage._my_garage_client(MagicMock(), _user(), "org2")
        self.assertIs(result, client)
        m.assert_called_once()

    def test_org_without_card_raises_403(self):
        with patch.object(garage, "my_active_autoservice_client", return_value=None):
            with self.assertRaises(HTTPException) as ctx:
                garage._my_garage_client(MagicMock(), _user(), "org2")
        self.assertEqual(ctx.exception.status_code, 403)


class UpdateDeleteOrgParamTests(unittest.TestCase):
    def test_update_passes_org_to_client_resolution(self):
        client = MagicMock()
        client.id = 5
        row = MagicMock()
        with (
            patch.object(garage, "_my_garage_client", return_value=client) as m_client,
            patch.object(garage, "_get_client_vehicle_or_404", return_value=row) as m_get,
            patch.object(garage, "_apply_vehicle_update", return_value=row) as m_apply,
            patch.object(garage, "_vehicle_to_view", return_value="view"),
        ):
            result = garage.update_garage_vehicle(
                10,
                GarageVehicleUpdate(make="Kia"),
                organization_id="org2",
                db=MagicMock(),
                current_user=_user(),
            )
        self.assertEqual(result, "view")
        m_client.assert_called_once()
        m_get.assert_called_once()
        m_apply.assert_called_once()

    def test_delete_without_org_keeps_default_behavior(self):
        client = MagicMock()
        client.id = 5
        row = MagicMock()
        db = MagicMock()
        db.query.return_value.filter.return_value.count.side_effect = [0, 0]
        with (
            patch.object(garage, "_my_garage_client", return_value=client) as m_client,
            patch.object(garage, "_get_client_vehicle_or_404", return_value=row),
        ):
            garage.delete_garage_vehicle(
                10,
                organization_id=None,
                db=db,
                current_user=_user(),
            )
        args = m_client.call_args[0]
        self.assertIsNone(args[2])
        db.delete.assert_called_once_with(row)

    def test_delete_blocked_by_orders(self):
        client = MagicMock()
        client.id = 5
        row = MagicMock()
        db = MagicMock()
        db.query.return_value.filter.return_value.count.side_effect = [2, 0]
        with (
            patch.object(garage, "_my_garage_client", return_value=client),
            patch.object(garage, "_get_client_vehicle_or_404", return_value=row),
        ):
            with self.assertRaises(HTTPException) as ctx:
                garage.delete_garage_vehicle(
                    10,
                    organization_id="org1",
                    db=db,
                    current_user=_user(),
                )
        self.assertEqual(ctx.exception.status_code, 400)
        db.delete.assert_not_called()


if __name__ == "__main__":
    unittest.main()
