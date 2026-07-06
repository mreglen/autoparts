import unittest
from unittest.mock import MagicMock, patch

from app.services.dashboard_tasks_service import get_dashboard_tasks


class DashboardTasksServiceTests(unittest.TestCase):
    def _seller(self):
        user = MagicMock()
        user.id = 1
        user.is_admin = False
        user.is_seller = True
        user.is_employee = False
        user.organization_id = "org123"
        return user

    @patch("app.services.dashboard_tasks_service._count_unread_messages", return_value=2)
    @patch("app.services.dashboard_tasks_service._has_sales_orders_access", return_value=True)
    @patch("app.services.dashboard_tasks_service._has_my_parts_access", return_value=True)
    @patch("app.services.dashboard_tasks_service._has_avito_integration_access", return_value=True)
    @patch("app.services.dashboard_tasks_service._count_avito_errors", return_value=2)
    def test_get_dashboard_tasks_includes_core_items(self, *_mocks):
        db = MagicMock()
        count_query = MagicMock()
        count_query.filter.return_value = count_query
        count_query.outerjoin.return_value = count_query
        count_query.distinct.return_value = count_query
        count_query.scalar.side_effect = [3, 1, 5, 2, 4, 7, 10]
        db.query.return_value = count_query

        result = get_dashboard_tasks(db, self._seller())

        task_ids = {task.id for task in result.tasks}
        self.assertIn("new_orders", task_ids)
        self.assertIn("unread_messages", task_ids)
        self.assertIn("avito_errors", task_ids)
        self.assertIn("products_no_photo", task_ids)
        self.assertEqual(result.tasks[0].severity, "high")

    @patch("app.services.dashboard_tasks_service._count_unread_messages", return_value=0)
    @patch("app.services.dashboard_tasks_service._has_sales_orders_access", return_value=False)
    @patch("app.services.dashboard_tasks_service._has_my_parts_access", return_value=False)
    @patch("app.services.dashboard_tasks_service._has_avito_integration_access", return_value=False)
    def test_get_dashboard_tasks_respects_missing_permissions(self, *_mocks):
        db = MagicMock()
        result = get_dashboard_tasks(db, self._seller())
        self.assertEqual(result.tasks, [])


if __name__ == "__main__":
    unittest.main()
