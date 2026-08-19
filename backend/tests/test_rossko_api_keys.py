import unittest
from unittest.mock import MagicMock, patch

from app.utils.rossko_api_keys import (
    RosskoApiKeysError,
    get_rossko_api_keys,
    rossko_api_keys_configured,
    save_rossko_api_keys,
)


class RosskoApiKeysTests(unittest.TestCase):
    def test_configured_flag(self):
        row = MagicMock(key1_encrypted="enc1", key2_encrypted="enc2")
        self.assertTrue(rossko_api_keys_configured(row))
        row.key2_encrypted = None
        self.assertFalse(rossko_api_keys_configured(row))

    @patch("app.utils.rossko_api_keys.encrypt_secret", side_effect=lambda value: f"enc:{value}")
    def test_save_and_read_from_db(self, _encrypt):
        row = MagicMock(
            key1_encrypted=None,
            key2_encrypted=None,
            updated_by_user_id=None,
        )
        db = MagicMock()

        with patch("app.utils.rossko_api_keys.get_or_create_rossko_settings", return_value=row):
            save_rossko_api_keys(db, " key1 ", "key2", user_id=7)

        self.assertEqual(row.key1_encrypted, "enc:key1")
        self.assertEqual(row.key2_encrypted, "enc:key2")
        self.assertEqual(row.updated_by_user_id, 7)
        db.add.assert_called_once_with(row)
        db.commit.assert_called_once()

    @patch("app.utils.rossko_api_keys._keys_from_env", return_value=None)
    @patch("app.utils.rossko_api_keys._keys_from_row", return_value=None)
    @patch("app.utils.rossko_api_keys.get_or_create_rossko_settings")
    def test_missing_keys_raise(self, mock_get_row, *_rest):
        mock_get_row.return_value = MagicMock(key1_encrypted=None, key2_encrypted=None)
        db = MagicMock()
        with self.assertRaises(RosskoApiKeysError):
            get_rossko_api_keys(db)


if __name__ == "__main__":
    unittest.main()
