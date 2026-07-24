import hashlib
import unittest
from unittest.mock import MagicMock, patch

from app.services.drom_api import (
    ERROR_AUTH_FAILED,
    ERROR_PACKET_NOT_FOUND,
    DromSyncResult,
    compute_auth,
    parse_drom_error,
    sync_price_list_chunk_sync,
    sync_price_list_chunks_sync,
)


class DromApiTests(unittest.TestCase):
    def test_compute_auth_sha512(self):
        key = "cabinet-secret-key"
        expected = hashlib.sha512(key.encode("utf-8")).hexdigest()
        self.assertEqual(compute_auth(key), expected)

    def test_parse_drom_error_codes(self):
        code, msg = parse_drom_error("ERROR_REASON_AUTH_FAILED", 403)
        self.assertEqual(code, ERROR_AUTH_FAILED)
        self.assertIn("ключ", msg.lower())

        code, _msg = parse_drom_error("oops ERROR_REASON_PACKET_NOT_FOUND here", 404)
        self.assertEqual(code, ERROR_PACKET_NOT_FOUND)

        code, msg = parse_drom_error("", 200)
        self.assertIsNone(code)
        self.assertEqual(msg, "")

    @patch("app.services.drom_api.httpx.Client")
    def test_sync_chunk_success(self, mock_client_cls):
        response = MagicMock()
        response.status_code = 200
        response.text = "OK"
        client = MagicMock()
        client.__enter__.return_value = client
        client.post.return_value = response
        mock_client_cls.return_value = client

        result = sync_price_list_chunk_sync(
            packet_id="55359",
            api_key="secret",
            file_bytes=b"fake-xlsx",
            filename="t.xlsx",
        )
        self.assertTrue(result.ok)
        self.assertEqual(result.status_code, 200)
        self.assertIsNone(result.error_code)
        kwargs = client.post.call_args.kwargs
        self.assertEqual(kwargs["data"]["packetId"], "55359")
        self.assertEqual(kwargs["data"]["auth"], compute_auth("secret"))

    @patch("app.services.drom_api.httpx.Client")
    def test_sync_chunk_auth_failed(self, mock_client_cls):
        response = MagicMock()
        response.status_code = 403
        response.text = "ERROR_REASON_AUTH_FAILED"
        client = MagicMock()
        client.__enter__.return_value = client
        client.post.return_value = response
        mock_client_cls.return_value = client

        result = sync_price_list_chunk_sync(
            packet_id="1",
            api_key="bad",
            file_bytes=b"x",
        )
        self.assertFalse(result.ok)
        self.assertEqual(result.error_code, ERROR_AUTH_FAILED)

    @patch("app.services.drom_api.sync_price_list_chunk_sync")
    def test_sync_chunks_stops_on_error(self, mock_one):
        mock_one.side_effect = [
            DromSyncResult(ok=True, status_code=200, body_text="OK", chunks_sent=1),
            DromSyncResult(
                ok=False,
                status_code=403,
                body_text=ERROR_AUTH_FAILED,
                error_code=ERROR_AUTH_FAILED,
                error_message="bad",
                chunks_sent=1,
            ),
        ]
        result = sync_price_list_chunks_sync(
            packet_id="1",
            api_key="k",
            chunks=[b"a", b"b", b"c"],
        )
        self.assertFalse(result.ok)
        self.assertEqual(result.chunks_sent, 2)
        self.assertEqual(mock_one.call_count, 2)


if __name__ == "__main__":
    unittest.main()
