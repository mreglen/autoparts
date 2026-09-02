import unittest

from app.services.rossko_part_selection import (
    get_rossko_min_price,
    get_rossko_stock_count,
    map_rossko_stocks,
)
from app.services.rossko_stock_filter import is_rossko_deliverable_stock


class RosskoStockFilterTests(unittest.TestCase):
    def test_deliverable_stock_requires_delivery_window(self):
        self.assertFalse(is_rossko_deliverable_stock({"id": "HST27", "count": 5}))
        self.assertTrue(
            is_rossko_deliverable_stock(
                {
                    "id": "HST27",
                    "count": 5,
                    "deliveryStart": "2026-01-01T10:00:00",
                    "deliveryEnd": "2026-01-01T18:00:00",
                }
            )
        )

    def test_stock_count_ignores_pickup_only(self):
        part = {
            "stocks": {
                "stock": [
                    {"id": "pickup", "price": "100", "count": "10"},
                    {
                        "id": "delivery",
                        "price": "110",
                        "count": "3",
                        "deliveryStart": "2026-01-01T10:00:00",
                        "deliveryEnd": "2026-01-01T18:00:00",
                    },
                ]
            }
        }
        self.assertEqual(get_rossko_stock_count(part), 3)
        self.assertEqual(get_rossko_min_price(part), 110.0)

    def test_map_rossko_stocks_skips_pickup_only(self):
        part = {
            "stocks": {
                "stock": [
                    {"id": "pickup", "price": "90", "count": "5"},
                    {
                        "id": "delivery",
                        "price": "100",
                        "count": "2",
                        "deliveryStart": "2026-01-01T10:00:00",
                        "deliveryEnd": "2026-01-01T18:00:00",
                    },
                ]
            }
        }
        mapped = map_rossko_stocks(part)
        self.assertEqual(len(mapped), 1)
        self.assertEqual(mapped[0]["stock_id"], "delivery")


if __name__ == "__main__":
    unittest.main()
