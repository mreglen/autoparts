import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from app.models.user import User
from app.utils.autoservice_access import (
    AUTOSERVICE_PERMISSION_ORDERS,
    AUTOSERVICE_PERMISSION_ORDERS_OWN,
    AUTOSERVICE_PERMISSION_PLANNER,
    has_autoservice_permission,
    orders_access_level,
    require_any_autoservice_permission,
    require_autoservice_permission,
    require_orders_access,
)


def _employee_user() -> User:
    user = User()
    user.id = 10
    user.is_admin = False
    user.is_director = False
    user.is_seller = False
    user.is_employee = True
    user.organization_id = "org-auto"
    return user


def _director_user() -> User:
    user = _employee_user()
    user.is_director = True
    return user


class AutoserviceAccessHelperTests(unittest.TestCase):
    def test_has_autoservice_permission_for_director_without_db_lookup(self):
        db = MagicMock()
        user = _director_user()

        self.assertTrue(has_autoservice_permission(db, user, AUTOSERVICE_PERMISSION_PLANNER))
        db.query.assert_not_called()

    def test_require_autoservice_permission_denies_employee_without_code(self):
        db = MagicMock()
        user = _employee_user()

        with patch(
            "app.utils.autoservice_access.require_autoservice_staff",
            return_value="org-auto",
        ):
            with self.assertRaises(HTTPException) as ctx:
                require_autoservice_permission(db, user, AUTOSERVICE_PERMISSION_ORDERS)

        self.assertEqual(ctx.exception.status_code, 403)

    def test_require_autoservice_permission_allows_employee_with_code(self):
        db = MagicMock()
        user = _employee_user()

        with patch(
            "app.utils.autoservice_access.require_autoservice_staff",
            return_value="org-auto",
        ):
            with patch(
                "app.utils.autoservice_access.has_autoservice_permission",
                return_value=True,
            ) as has_perm:
                org_id = require_autoservice_permission(db, user, AUTOSERVICE_PERMISSION_ORDERS)

        self.assertEqual(org_id, "org-auto")
        has_perm.assert_called_once_with(db, user, AUTOSERVICE_PERMISSION_ORDERS)

    def test_require_any_autoservice_permission_accepts_one_of_codes(self):
        db = MagicMock()
        user = _employee_user()

        with patch(
            "app.utils.autoservice_access.require_autoservice_staff",
            return_value="org-auto",
        ):
            with patch(
                "app.utils.autoservice_access.has_autoservice_permission",
                side_effect=lambda _db, _user, code: code == AUTOSERVICE_PERMISSION_PLANNER,
            ):
                org_id = require_any_autoservice_permission(
                    db,
                    user,
                    AUTOSERVICE_PERMISSION_ORDERS,
                    AUTOSERVICE_PERMISSION_PLANNER,
                )

        self.assertEqual(org_id, "org-auto")

    def test_orders_access_level_full_before_own(self):
        db = MagicMock()
        user = _employee_user()

        with patch(
            "app.utils.autoservice_access.has_autoservice_permission",
            side_effect=lambda _db, _user, code: code in (
                AUTOSERVICE_PERMISSION_ORDERS,
                AUTOSERVICE_PERMISSION_ORDERS_OWN,
            ),
        ):
            self.assertEqual(orders_access_level(db, user), "full")

    def test_require_orders_access_own_for_employee(self):
        db = MagicMock()
        user = _employee_user()

        with patch(
            "app.utils.autoservice_access.require_autoservice_staff",
            return_value="org-auto",
        ):
            with patch(
                "app.utils.autoservice_access.has_autoservice_permission",
                side_effect=lambda _db, _user, code: code == AUTOSERVICE_PERMISSION_ORDERS_OWN,
            ):
                org_id, level = require_orders_access(db, user)

        self.assertEqual(org_id, "org-auto")
        self.assertEqual(level, "own")


if __name__ == "__main__":
    unittest.main()
