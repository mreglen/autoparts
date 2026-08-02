import unittest
from unittest.mock import MagicMock, patch

from app.services.laximo.cat_client import LaximoCatError
from app.services.laximo.gate import assert_public_message_safe
from app.services.laximo.unit_tree import clear_unit_tree_cache, search_details


class SearchVehicleDetailsTests(unittest.TestCase):
    def setUp(self):
        clear_unit_tree_cache()

    def test_not_ready_skips_svd(self):
        with patch(
            "app.services.laximo.unit_tree.laximo_cat_ready",
            return_value=False,
        ), patch(
            "app.services.laximo.unit_tree.cat_client.search_vehicle_details"
        ) as svd:
            result = search_details(
                MagicMock(),
                catalog="AU1587",
                vehicle_id="1",
                ssd="ssd-token",
                query="колодки",
            )
        svd.assert_not_called()
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "temporarily_unavailable")
        self.assertTrue(assert_public_message_safe(result.message or ""))

    def test_no_fulltext_feature_empty_without_http(self):
        with patch(
            "app.services.laximo.unit_tree.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.unit_tree.has_fulltextsearch",
            return_value=False,
        ), patch(
            "app.services.laximo.unit_tree.cat_client.search_vehicle_details"
        ) as svd:
            result = search_details(
                MagicMock(),
                catalog="AU1587",
                vehicle_id="1",
                ssd="ssd-token",
                query="колодки",
            )
        svd.assert_not_called()
        self.assertTrue(result.ok)
        self.assertEqual(result.payload.get("details"), [])
        self.assertFalse(result.payload.get("has_fulltextsearch"))

    def test_mock_svd_returns_details(self):
        with patch(
            "app.services.laximo.unit_tree.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.unit_tree.has_fulltextsearch",
            return_value=True,
        ), patch(
            "app.services.laximo.unit_tree.cat_client.search_vehicle_details",
            return_value=[
                {"oem": "059198405B", "name": "filter element"},
                {"oem": "059115389AD", "name": "oil filter"},
            ],
        ) as svd:
            result = search_details(
                MagicMock(),
                catalog="AU1587",
                vehicle_id="1",
                ssd="ssd-token",
                query="фильтр",
            )
        svd.assert_called_once()
        self.assertTrue(svd.call_args.kwargs.get("count_toward_quota"))
        self.assertTrue(result.ok)
        self.assertEqual(len(result.payload["details"]), 2)
        self.assertEqual(result.payload["details"][0]["oem"], "059198405B")
        self.assertTrue(result.payload["has_fulltextsearch"])

    def test_upstream_fail_soft(self):
        with patch(
            "app.services.laximo.unit_tree.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.unit_tree.has_fulltextsearch",
            return_value=True,
        ), patch(
            "app.services.laximo.unit_tree.cat_client.search_vehicle_details",
            side_effect=LaximoCatError("HTTP 403"),
        ):
            result = search_details(
                MagicMock(),
                catalog="AU1587",
                vehicle_id="1",
                ssd="ssd-token",
                query="колодки",
            )
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "temporarily_unavailable")
        self.assertTrue(assert_public_message_safe(result.message or ""))

    def test_missing_ctx_session_expired(self):
        with patch(
            "app.services.laximo.unit_tree.laximo_cat_ready",
            return_value=True,
        ):
            result = search_details(
                MagicMock(),
                catalog="AU1587",
                vehicle_id="",
                ssd="",
                query="колодки",
            )
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "session_expired")

    def test_features_includes_fulltext_flag(self):
        from app.services.laximo.unit_tree import get_features

        with patch(
            "app.services.laximo.unit_tree.laximo_cat_ready",
            return_value=True,
        ), patch(
            "app.services.laximo.unit_tree.get_catalog_features",
            return_value={"quickgroups", "fulltextsearch"},
        ):
            result = get_features(MagicMock(), "AU1587")
        self.assertTrue(result.ok)
        self.assertTrue(result.payload.get("has_fulltextsearch"))
        self.assertTrue(result.payload.get("has_quickgroups"))


class DetailsSearchClientTests(unittest.TestCase):
    def test_client_normalizes_rows(self):
        from app.services.laximo import cat_client

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b'[{"oem":"A1","name":"Pad"},{"oem":"a1","name":"dup"}]'
        mock_response.json.return_value = [
            {"oem": "A1", "name": "Pad"},
            {"oem": "a1", "name": "dup"},
        ]

        with patch.object(
            cat_client,
            "_resolve_credentials",
            return_value=("u", "p", "https://ws.laximo.ru/restApi/v1"),
        ), patch(
            "app.services.laximo.cat_client.increment_laximo_request_counter"
        ) as inc, patch("httpx.Client") as client_cls:
            client = MagicMock()
            client.__enter__.return_value = client
            client.__exit__.return_value = False
            client.post.return_value = mock_response
            client_cls.return_value = client
            rows = cat_client.search_vehicle_details(
                MagicMock(),
                catalog="AU1587",
                vehicle_id="1",
                ssd="ssd",
                query="pad",
                count_toward_quota=True,
            )
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["oem"], "A1")
        inc.assert_called()


if __name__ == "__main__":
    unittest.main()
