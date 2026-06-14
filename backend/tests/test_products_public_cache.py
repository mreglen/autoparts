import json
import unittest
from unittest.mock import MagicMock, patch

from app.utils.json_cache_sync import get_cached_json_sync, set_cached_json_sync


class JsonCacheSyncTests(unittest.TestCase):
    @patch("app.utils.json_cache_sync.get_redis_sync")
    def test_get_returns_parsed_json(self, mock_get_redis):
        client = MagicMock()
        client.get.return_value = json.dumps([{"id": 1}], ensure_ascii=False)
        mock_get_redis.return_value = client

        result = get_cached_json_sync("products:public:storage_location:all")

        self.assertEqual(result, [{"id": 1}])
        client.get.assert_called_once_with("products:public:storage_location:all")

    @patch("app.utils.json_cache_sync.get_redis_sync")
    def test_set_stores_json_with_ttl(self, mock_get_redis):
        client = MagicMock()
        mock_get_redis.return_value = client

        set_cached_json_sync("products:public:storage_location:all", [{"id": 2}], 45)

        client.setex.assert_called_once()
        key, ttl, payload = client.setex.call_args[0]
        self.assertEqual(key, "products:public:storage_location:all")
        self.assertEqual(ttl, 45)
        self.assertEqual(json.loads(payload), [{"id": 2}])


if __name__ == "__main__":
    unittest.main()
