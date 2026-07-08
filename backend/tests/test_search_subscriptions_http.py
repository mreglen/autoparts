import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.db.database import get_db
from app.routers.user_engagement import router


class SearchSubscriptionsHttpTests(unittest.TestCase):
    def setUp(self):
        self.mock_user = MagicMock()
        self.mock_user.id = 1
        self.mock_db = MagicMock()

        def override_user():
            return self.mock_user

        def override_db():
            yield self.mock_db

        self.app = FastAPI()
        self.app.include_router(router, prefix="/api")
        self.app.dependency_overrides[get_current_user] = override_user
        self.app.dependency_overrides[get_db] = override_db
        self.client = TestClient(self.app)

    def tearDown(self):
        self.app.dependency_overrides.clear()

    @patch("app.routers.user_engagement.subscriptions.list_search_subscriptions")
    def test_list_search_subscriptions(self, mock_list):
        mock_row = MagicMock()
        mock_row.id = 1
        mock_row.query_text = "bosch"
        mock_row.is_active = True
        mock_row.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
        mock_row.last_notified_at = None
        mock_list.return_value = [mock_row]

        response = self.client.get("/api/user/search-subscriptions")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(body["items"]), 1)
        self.assertEqual(body["items"][0]["query_text"], "bosch")
        mock_list.assert_called_once_with(self.mock_db, 1)

    @patch("app.routers.user_engagement.subscriptions.create_search_subscription")
    def test_create_search_subscription(self, mock_create):
        mock_row = MagicMock()
        mock_row.id = 2
        mock_row.query_text = "bosch"
        mock_row.is_active = True
        mock_row.created_at = datetime(2026, 1, 2, tzinfo=timezone.utc)
        mock_row.last_notified_at = None
        mock_create.return_value = mock_row

        response = self.client.post(
            "/api/user/search-subscriptions",
            json={"query": "bosch"},
        )

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["query_text"], "bosch")
        mock_create.assert_called_once_with(self.mock_db, 1, "bosch")


if __name__ == "__main__":
    unittest.main()
