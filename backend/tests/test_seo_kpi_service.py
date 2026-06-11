import unittest
from unittest.mock import MagicMock, patch

from app.services.seo_kpi_service import _cluster_summary, _normalize_gsc_rows, _normalize_yandex_rows


class SeoKpiServiceTests(unittest.TestCase):
    def test_normalize_gsc_rows(self):
        payload = {
            "rows": [
                {
                    "keys": ["bosch if1009 купить"],
                    "impressions": 100,
                    "clicks": 5,
                    "position": 8.2,
                }
            ]
        }
        rows = _normalize_gsc_rows(payload)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["cluster"], "A")
        self.assertEqual(rows[0]["ctr"], 5.0)

    def test_normalize_yandex_rows(self):
        payload = {
            "queries": [
                {
                    "query_text": "автозапчасти екатеринбург",
                    "indicators": {
                        "TOTAL_SHOWS": 200,
                        "TOTAL_CLICKS": 10,
                        "AVG_SHOW_POSITION": 12.5,
                    },
                }
            ]
        }
        rows = _normalize_yandex_rows(payload)
        self.assertEqual(rows[0]["cluster"], "D")
        self.assertEqual(rows[0]["ctr"], 5.0)

    def test_cluster_summary(self):
        rows = [
            {"cluster": "A", "impressions": 10, "clicks": 1, "position": 5},
            {"cluster": "B", "impressions": 20, "clicks": 2, "position": 7},
        ]
        summary = _cluster_summary(rows)
        self.assertIn("A", summary)
        self.assertEqual(summary["A"]["clicks"], 1.0)

    @patch("app.services.seo_kpi_service.get_or_create_google_integration")
    @patch("app.services.seo_kpi_service.get_or_create_yandex_integration")
    def test_build_dashboard_without_tokens(self, mock_yandex, mock_google):
        from app.services.seo_kpi_service import build_seo_kpi_dashboard

        yandex_row = MagicMock(access_token_encrypted=None, host_url="https://svoygarage.ru", host_id=None)
        google_row = MagicMock(access_token_encrypted=None, site_url=None)
        mock_yandex.return_value = yandex_row
        mock_google.return_value = google_row

        db = MagicMock()
        with patch("app.services.seo_kpi_service._sitemap_indexation_summary", return_value={"products_urls": 1}):
            result = build_seo_kpi_dashboard(db, days=7)
        self.assertFalse(result["yandex"]["connected"])
        self.assertFalse(result["google"]["connected"])
        self.assertIn("sitemap", result)
