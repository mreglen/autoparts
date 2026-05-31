import unittest
from decimal import Decimal
from unittest.mock import MagicMock

from app.services.yandex_feed_xml_service import (
    _normalize_condition_quality,
    _normalize_condition_type,
    _offer_lines,
)


class YandexFeedXmlTests(unittest.TestCase):
    def test_normalize_condition_quality(self):
        self.assertEqual(_normalize_condition_quality("excellent"), "excellent")
        self.assertEqual(_normalize_condition_quality("unknown"), "good")
        self.assertEqual(_normalize_condition_quality(None), "good")

    def test_normalize_condition_type(self):
        self.assertEqual(_normalize_condition_type("preowned"), "preowned")
        self.assertEqual(_normalize_condition_type("invalid"), "preowned")

    def test_used_offer_contains_quality_inside_condition(self):
        product = MagicMock()
        product.id = 21
        product.part_type_id = 1
        product.name = "Тестовая запчасть"
        product.brand = "Brand"
        product.article = "45G"
        product.price = Decimal("1000.00")
        product.quantity = 1
        product.is_new = False
        product.description = "Описание"
        product.part_type = MagicMock(name="Автозапчасти")
        photo = MagicMock(photo_url="/uploads/pictures/test.jpg")
        product.photos = [photo]
        product.compatible_vehicles = []

        lines = _offer_lines(
            product,
            site_origin="https://svoygarage.ru",
            used_condition_type="preowned",
            used_condition_quality="good",
            used_condition_reason="Проверен продавцом",
        )
        self.assertIsNotNone(lines)
        xml = "\n".join(lines)
        self.assertIn("<name>Brand 45G Тестовая запчасть</name>", xml)
        self.assertNotIn("typePrefix", xml)
        self.assertIn('<condition type="preowned">', xml)
        self.assertIn("<quality>good</quality>", xml)
        self.assertIn("<reason>", xml)


if __name__ == "__main__":
    unittest.main()
