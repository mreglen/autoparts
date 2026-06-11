import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.new_parts_seo_refresh_service import refresh_new_parts_seo_cards


class RefreshNewPartsSeoCardsTests(unittest.TestCase):
    def _run(self, coro):
        return asyncio.run(coro)

    @patch("app.services.new_parts_seo_refresh_service.asyncio.sleep", new_callable=AsyncMock)
    @patch("app.services.new_parts_seo_refresh_service.create_or_get_new_part_card")
    @patch("app.services.new_parts_seo_refresh_service._fetch_rossko_search", new_callable=AsyncMock)
    @patch("app.services.new_parts_seo_refresh_service.iter_cards_for_refresh")
    def test_updates_existing_cards(self, mock_iter, mock_rossko, mock_create, _sleep):
        card = MagicMock(id=1, brand="MANN", article="IF1009")
        mock_iter.return_value = [card]
        mock_rossko.return_value = {
            "PartsList": {
                "Part": {
                    "brand": "MANN",
                    "partnumber": "IF1009",
                    "name": "Filter",
                    "stocks": {"stock": {"count": 3, "price": 100, "id": "s1"}},
                }
            }
        }

        result = self._run(refresh_new_parts_seo_cards(MagicMock(), batch_size=10))

        self.assertEqual(result.candidates, 1)
        self.assertEqual(result.updated, 1)
        mock_create.assert_called_once()


if __name__ == "__main__":
    unittest.main()
