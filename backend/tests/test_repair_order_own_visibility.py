import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.routers.autoservice_repair_orders import _user_participates_in_order


class OwnOrderVisibilityTests(unittest.TestCase):
    def test_creator_participates(self):
        user = SimpleNamespace(id=7)
        order = SimpleNamespace(
            created_by_user_id=7,
            accepted_by_user_id=1,
            assignees=[],
            employee_assignees=[],
            works=[],
        )
        self.assertTrue(_user_participates_in_order(MagicMock(), "ORG", order, user))

    def test_assignee_participates(self):
        user = SimpleNamespace(id=7)
        order = SimpleNamespace(
            created_by_user_id=1,
            accepted_by_user_id=1,
            assignees=[SimpleNamespace(id=7)],
            employee_assignees=[],
            works=[],
        )
        self.assertTrue(_user_participates_in_order(MagicMock(), "ORG", order, user))

    def test_work_executor_participates(self):
        user = SimpleNamespace(id=7)
        db = MagicMock()
        card = SimpleNamespace(id=18, legacy_service_employee_id=11)
        db.query.return_value.filter.return_value.first.side_effect = [
            (18,),  # organization employee id
            card,  # service employee lookup
        ]
        # First call is org employee id query returning tuple; second is full card.
        # Re-implement more carefully with side_effect per query chain.
        order = SimpleNamespace(
            created_by_user_id=1,
            accepted_by_user_id=1,
            assignees=[],
            employee_assignees=[],
            works=[
                SimpleNamespace(
                    executor_user_id=None,
                    executors=[SimpleNamespace(employee_id=11, organization_employee_id=None)],
                )
            ],
        )

        def service_id_side_effect(*_args, **_kwargs):
            return 11

        def org_id_side_effect(*_args, **_kwargs):
            return 18

        with unittest.mock.patch(
            "app.routers.autoservice_repair_orders._service_employee_id_for_user",
            side_effect=service_id_side_effect,
        ), unittest.mock.patch(
            "app.routers.autoservice_repair_orders._organization_employee_id_for_user",
            side_effect=org_id_side_effect,
        ):
            self.assertTrue(_user_participates_in_order(db, "ORG", order, user))

    def test_unrelated_user_does_not_participate(self):
        user = SimpleNamespace(id=99)
        order = SimpleNamespace(
            created_by_user_id=1,
            accepted_by_user_id=1,
            assignees=[SimpleNamespace(id=7)],
            employee_assignees=[],
            works=[
                SimpleNamespace(
                    executor_user_id=None,
                    executors=[SimpleNamespace(employee_id=11, organization_employee_id=18)],
                )
            ],
        )
        with unittest.mock.patch(
            "app.routers.autoservice_repair_orders._service_employee_id_for_user",
            return_value=None,
        ), unittest.mock.patch(
            "app.routers.autoservice_repair_orders._organization_employee_id_for_user",
            return_value=None,
        ):
            self.assertFalse(_user_participates_in_order(MagicMock(), "ORG", order, user))


if __name__ == "__main__":
    unittest.main()
