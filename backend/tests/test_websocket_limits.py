import asyncio
import importlib.util
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

_ws_path = Path(__file__).resolve().parents[1] / "app" / "routers" / "websocket.py"
_spec = importlib.util.spec_from_file_location("websocket_module_under_test", _ws_path)
_ws = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_ws)

ConnectionManager = _ws.ConnectionManager
MAX_WS_CONNECTIONS_PER_USER = _ws.MAX_WS_CONNECTIONS_PER_USER


class WebSocketConnectionLimitTests(unittest.TestCase):
    def test_rejects_when_limit_reached(self):
        manager = ConnectionManager()
        manager.active_connections[1] = {MagicMock() for _ in range(MAX_WS_CONNECTIONS_PER_USER)}

        async def run():
            ws = AsyncMock()
            return await manager.connect(ws, 1)

        result = asyncio.run(run())
        self.assertFalse(result)
        self.assertEqual(manager.connection_count(1), MAX_WS_CONNECTIONS_PER_USER)

    def test_accepts_under_limit(self):
        manager = ConnectionManager()

        async def run():
            ws = AsyncMock()
            return await manager.connect(ws, 42)

        result = asyncio.run(run())
        self.assertTrue(result)
        self.assertEqual(manager.connection_count(42), 1)


if __name__ == "__main__":
    unittest.main()
