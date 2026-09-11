import unittest
from datetime import datetime
from types import SimpleNamespace

from app.services.cart_delivery_refresh import _apply_delivery, _fastest_stock_offer


class CartDeliveryRefreshTests(unittest.TestCase):
    def test_missing_offer_preserves_last_known_delivery(self):
        start = datetime(2026, 1, 1, 10, 0)
        end = datetime(2026, 1, 1, 18, 0)
        item = SimpleNamespace(
            brand="MANN",
            partnumber="W712",
            stock_id="stock-1",
            delivery_start=start,
            delivery_end=end,
            delivery=None,
        )

        changed = _apply_delivery(item, None)

        self.assertFalse(changed)
        self.assertEqual(item.delivery_start, start)
        self.assertEqual(item.delivery_end, end)

    def test_fastest_offer_finds_stock_from_duplicate_part(self):
        data = {
            "PartsList": {
                "Part": [
                    {
                        "brand": "MANN",
                        "partnumber": "W712",
                        "stocks": {
                            "stock": {
                                "id": "stock-1",
                                "count": 1,
                                "price": 100,
                                "deliveryStart": "2026-01-02T10:00:00",
                                "deliveryEnd": "2026-01-02T18:00:00",
                            }
                        },
                    },
                    {
                        "brand": "MANN",
                        "partnumber": "W-712",
                        "stocks": {
                            "stock": {
                                "id": "stock-2",
                                "count": 1,
                                "price": 110,
                                "deliveryStart": "2026-01-01T10:00:00",
                                "deliveryEnd": "2026-01-01T18:00:00",
                            }
                        },
                    },
                ]
            }
        }

        offer = _fastest_stock_offer(
            data,
            brand="MANN",
            partnumber="W712",
            stock_id="stock-2",
        )

        self.assertIsNotNone(offer)
        self.assertEqual(offer["stock_id"], "stock-2")
        self.assertEqual(offer["delivery_start"], "2026-01-01T10:00:00")


if __name__ == "__main__":
    unittest.main()
