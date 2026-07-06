import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.printer_agent_hub import PrinterAgentHub, PRINTER_ONLINE_KEY_PREFIX


class PrinterAgentHubTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.hub = PrinterAgentHub()

    async def test_is_online_true_when_local_connection_exists(self):
        self.hub._local[7] = {"websocket": MagicMock()}
        self.assertTrue(await self.hub.is_online(7))

    async def test_filter_online_merges_local_and_redis(self):
        self.hub._local[2] = {"websocket": MagicMock()}
        mock_redis = AsyncMock()
        mock_redis.mget = AsyncMock(return_value=[None, None, "1"])
        mock_redis.aclose = AsyncMock()

        with patch("redis.asyncio.Redis.from_url", return_value=mock_redis):
            online = await self.hub.filter_online([1, 2, 3])

        self.assertEqual(online, [2, 3])
        mock_redis.mget.assert_awaited_once_with(
            [
                f"{PRINTER_ONLINE_KEY_PREFIX}1",
                f"{PRINTER_ONLINE_KEY_PREFIX}2",
                f"{PRINTER_ONLINE_KEY_PREFIX}3",
            ]
        )

    async def test_send_command_delivers_locally_on_redis_failure(self):
        ws = AsyncMock()
        self.hub._local[5] = {"websocket": ws}

        with patch.object(self.hub, "is_online", AsyncMock(return_value=True)):
            with patch("redis.asyncio.Redis.from_url", side_effect=ConnectionError("down")):
                await self.hub.send_command(5, {"type": "print", "data": {}})

        ws.send_json.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
