import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.avito_orders_api import accept_return_order, get_available_transitions


class AvitoReturnApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_get_available_transitions_on_return(self):
        transitions = await get_available_transitions(
            "token",
            order_id=123,
            order_status="on_return",
        )
        self.assertIn("in_transit_return", transitions)

    async def test_get_available_transitions_in_transit_return(self):
        transitions = await get_available_transitions(
            "token",
            order_id=123,
            order_status="in_transit_return",
        )
        self.assertIn("on_delivery_return", transitions)

    @patch("app.services.avito_orders_api.httpx.AsyncClient")
    async def test_accept_return_order_payload(self, mock_client_cls):
        mock_response = MagicMock()
        mock_response.content = b'{"ok": true}'
        mock_response.json.return_value = {"ok": True}
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_cls.return_value = mock_client

        result = await accept_return_order(
            "test-token",
            order_id=999,
            terminal_number="123456",
            recipient={"name": "Seller"},
        )

        self.assertEqual(result, {"ok": True})
        mock_client.post.assert_awaited_once()
        call_args = mock_client.post.call_args
        body = call_args.kwargs["json"]
        self.assertEqual(body["orderId"], "999")
        self.assertEqual(body["terminalNumber"], "123456")
        self.assertEqual(body["recipient"]["name"], "Seller")


if __name__ == "__main__":
    unittest.main()
