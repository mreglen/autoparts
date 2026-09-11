import unittest
from datetime import datetime

from app.services.rossko_part_selection import (
    extract_rossko_parts,
    get_rossko_min_price,
    get_rossko_stock_count,
    map_rossko_stocks,
)
from app.services.rossko_stock_filter import (
    filter_search_payload_stocks,
    is_rossko_deliverable_stock,
)


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

    def test_mapping_preferred_ids_do_not_filter_regular_stocks(self):
        window = {
            "deliveryStart": "2026-01-01T10:00:00",
            "deliveryEnd": "2026-01-01T18:00:00",
        }
        part = {
            "stocks": {
                "stock": [
                    {"id": "preferred", "price": 100, "count": 1, **window},
                    {"id": "regular", "price": 110, "count": 2, **window},
                ]
            }
        }

        mapped = map_rossko_stocks(part, allowed_stock_ids=frozenset({"preferred"}))

        self.assertEqual([stock["stock_id"] for stock in mapped], ["preferred", "regular"])
        self.assertTrue(mapped[0]["is_preferred"])
        self.assertFalse(mapped[1]["is_preferred"])

    def test_payload_keeps_all_delivery_stocks_and_marks_preferred(self):
        data = {
            "PartsList": {
                "Part": {
                    "brand": "MANN",
                    "partnumber": "W712",
                    "stocks": {
                        "stock": [
                            {"id": "pickup", "count": 4, "price": 90},
                            {
                                "id": "preferred",
                                "count": 1,
                                "price": 100,
                                "deliveryStart": "2026-01-01T10:00:00",
                                "deliveryEnd": "2026-01-01T18:00:00",
                            },
                            {
                                "id": "regular",
                                "count": 2,
                                "price": 110,
                                "deliveryStart": "2026-01-02T10:00:00",
                                "deliveryEnd": "2026-01-02T18:00:00",
                            },
                        ]
                    },
                }
            }
        }

        filter_search_payload_stocks(data, frozenset({"preferred"}))

        stocks = data["PartsList"]["Part"]["stocks"]["stock"]
        self.assertEqual([stock["id"] for stock in stocks], ["preferred", "regular"])
        self.assertTrue(stocks[0]["is_preferred"])
        self.assertFalse(stocks[1]["is_preferred"])

    def test_payload_filters_pickup_when_no_preferred_stocks(self):
        data = {
            "PartsList": {
                "Part": {
                    "stocks": {
                        "stock": [
                            {"id": "pickup", "count": 1, "price": 90},
                            {
                                "id": "delivery",
                                "count": 1,
                                "price": 100,
                                "deliveryStart": "2026-01-01T10:00:00",
                                "deliveryEnd": "2026-01-01T18:00:00",
                            },
                        ]
                    }
                }
            }
        }

        filter_search_payload_stocks(data, None)

        stock = data["PartsList"]["Part"]["stocks"]["stock"]
        self.assertEqual(stock["id"], "delivery")
        self.assertFalse(stock["is_preferred"])

    def test_mapping_preserves_datetime_and_merges_duplicate_part_stocks(self):
        start = datetime(2026, 1, 1, 10, 0)
        end = datetime(2026, 1, 1, 18, 0)
        data = {
            "PartsList": {
                "Part": [
                    {
                        "brand": "MANN",
                        "partnumber": "W712",
                        "stocks": {"stock": {"id": "first", "count": 1, "price": 100, "deliveryStart": start, "deliveryEnd": end}},
                    },
                    {
                        "brand": "MANN",
                        "partnumber": "W-712",
                        "stocks": {"stock": {"id": "second", "count": 2, "price": 110, "deliveryStart": start, "deliveryEnd": end, "is_preferred": True}},
                    },
                ]
            }
        }

        parts = extract_rossko_parts(data)
        mapped = map_rossko_stocks(parts[0])

        self.assertEqual(len(parts), 1)
        self.assertEqual({stock["stock_id"] for stock in mapped}, {"first", "second"})
        self.assertEqual(mapped[0]["delivery_start"], start.isoformat())
        self.assertTrue(next(stock for stock in mapped if stock["stock_id"] == "second")["is_preferred"])


if __name__ == "__main__":
    unittest.main()
