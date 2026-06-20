import unittest
from unittest.mock import patch

import app.models  # noqa: F401
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.models.seo_landing_page import SeoLandingPage
from app.services.analytics_query_review_service import _recommend_action, run_query_review


class AnalyticsQueryReviewServiceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        self._create_tables()
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _create_tables(self):
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    CREATE TABLE analytics_query_review_snapshots (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        created_at DATETIME,
                        period_start DATE NOT NULL,
                        period_end DATE NOT NULL,
                        source VARCHAR(32) NOT NULL DEFAULT 'yandex_webmaster',
                        status VARCHAR(32) NOT NULL DEFAULT 'ok',
                        error_message TEXT
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE analytics_query_review_items (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        snapshot_id INTEGER NOT NULL,
                        query_text VARCHAR(512) NOT NULL,
                        cluster VARCHAR(16) NOT NULL DEFAULT 'unknown',
                        impressions INTEGER NOT NULL DEFAULT 0,
                        clicks INTEGER NOT NULL DEFAULT 0,
                        ctr VARCHAR(16) NOT NULL DEFAULT '0',
                        position VARCHAR(16) NOT NULL DEFAULT '0',
                        matched_path VARCHAR(512),
                        recommendation VARCHAR(32) NOT NULL DEFAULT 'review',
                        recommendation_label VARCHAR(128) NOT NULL DEFAULT '',
                        sort_order INTEGER NOT NULL DEFAULT 0
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE seo_landing_pages (
                        id INTEGER PRIMARY KEY,
                        kind VARCHAR(32) NOT NULL,
                        slug VARCHAR(120) NOT NULL,
                        title_ru VARCHAR(255) NOT NULL,
                        search_query VARCHAR(255),
                        brand_name VARCHAR(120),
                        part_type_id INTEGER,
                        city VARCHAR(120),
                        meta_title VARCHAR(255),
                        meta_description VARCHAR(512),
                        intro_html TEXT,
                        is_active BOOLEAN NOT NULL DEFAULT 1,
                        priority INTEGER NOT NULL DEFAULT 0,
                        created_at DATETIME,
                        updated_at DATETIME
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE site_yandex_integrations (
                        id INTEGER PRIMARY KEY,
                        host_url VARCHAR(255),
                        host_id VARCHAR(64),
                        client_id VARCHAR(255),
                        client_secret_encrypted TEXT,
                        access_token_encrypted TEXT,
                        refresh_token_encrypted TEXT,
                        token_expires_at DATETIME,
                        last_token_refresh_at DATETIME
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    INSERT INTO site_yandex_integrations (id, host_url)
                    VALUES (1, 'https://svoygarage.ru')
                    """
                )
            )

    def test_recommend_create_landing_for_brand_without_page(self):
        action, label = _recommend_action(
            cluster="B",
            matched_path=None,
            ctr=1.0,
            impressions=200,
        )
        self.assertEqual(action, "create_landing")
        self.assertIn("посадоч", label.lower())

    def test_recommend_improve_title_for_low_ctr(self):
        action, label = _recommend_action(
            cluster="C",
            matched_path="/autoparts/new/category/filters",
            ctr=1.0,
            impressions=500,
        )
        self.assertEqual(action, "improve_title")

    @patch("app.services.analytics_query_review_service.resolve_search_query")
    @patch("app.services.analytics_query_review_service.get_valid_access_token")
    @patch("app.services.analytics_query_review_service.get_user")
    @patch("app.services.analytics_query_review_service.get_popular_search_queries")
    def test_run_query_review_creates_snapshot(
        self, mock_popular, mock_user, mock_token, mock_resolve
    ):
        mock_token.return_value = "token"
        mock_user.return_value = {"user_id": 1}
        mock_popular.return_value = {
            "queries": [
                {
                    "query_text": "запчасти bosch",
                    "indicators": {
                        "TOTAL_SHOWS": 300,
                        "TOTAL_CLICKS": 10,
                        "AVG_SHOW_POSITION": 8.5,
                    },
                }
            ]
        }
        from app.services.search_resolve_service import ResolveSearchResult

        mock_resolve.return_value = ResolveSearchResult(
            status="fallback",
            redirect_path="/autoparts/used?q=bosch",
            redirect_url="https://svoygarage.ru/autoparts/used?q=bosch",
            match_type="listing",
        )

        with patch("app.services.analytics_query_review_service.get_or_create_yandex_integration") as mock_integration:
            integration = mock_integration.return_value
            integration.access_token_encrypted = "enc"
            integration.host_id = "host-1"
            integration.host_url = "https://svoygarage.ru"

            result = run_query_review(self.db, days=28, limit=50)

        self.assertEqual(result.status, "ok")
        self.assertGreaterEqual(len(result.items), 1)
        self.assertIn(result.items[0].recommendation, {"create_landing", "review", "covered"})


if __name__ == "__main__":
    unittest.main()
