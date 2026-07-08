import unittest
from pathlib import Path

from app.services.drom_autoload_xlsx import (
    parse_and_validate_drom_autoload,
    remove_product_from_drom_autoload,
    upsert_products_to_drom_autoload,
)


class DromAutoloadXlsxTests(unittest.TestCase):
    def _sample_row(self, *, article="ART-001", name="Фильтр масляный", price=1500, quantity=2):
        return {
            "product_id": 1,
            "article": article,
            "name": name,
            "is_new": True,
            "brand": "Toyota",
            "price": price,
            "quantity": quantity,
            "photos": ["/pictures/test.jpg"],
            "storage_address": "г. Москва, ул. Тестовая, 1",
        }

    def test_upsert_creates_valid_xlsx_from_template(self):
        xlsx_bytes = upsert_products_to_drom_autoload(
            None,
            [self._sample_row()],
            public_base_url="https://example.com",
        )
        parsed = parse_and_validate_drom_autoload(xlsx_bytes)
        self.assertTrue(parsed.local_ok, parsed.local_errors)
        self.assertEqual(len(parsed.items), 1)
        self.assertEqual(parsed.items[0]["article"], "ART-001")

    def test_upsert_updates_existing_article(self):
        first = upsert_products_to_drom_autoload(None, [self._sample_row(price=1000)], public_base_url="")
        second = upsert_products_to_drom_autoload(
            first,
            [self._sample_row(price=2000, name="Фильтр обновлённый")],
            public_base_url="",
        )
        parsed = parse_and_validate_drom_autoload(second)
        self.assertTrue(parsed.local_ok, parsed.local_errors)
        self.assertEqual(len(parsed.items), 1)
        self.assertEqual(float(parsed.items[0]["price"]), 2000.0)

    def test_validation_fails_on_invalid_price(self):
        xlsx_bytes = upsert_products_to_drom_autoload(
            None,
            [self._sample_row(price=0)],
            public_base_url="",
        )
        parsed = parse_and_validate_drom_autoload(xlsx_bytes)
        self.assertFalse(parsed.local_ok)
        self.assertTrue(len(parsed.local_errors) >= 1)

    def test_remove_product_from_xlsx(self):
        xlsx_bytes = upsert_products_to_drom_autoload(
            None,
            [
                self._sample_row(article="A1"),
                self._sample_row(article="A2", name="Другая деталь"),
            ],
            public_base_url="",
        )
        updated = remove_product_from_drom_autoload(xlsx_bytes, "A1")
        parsed = parse_and_validate_drom_autoload(updated)
        self.assertTrue(parsed.local_ok, parsed.local_errors)
        self.assertEqual(len(parsed.items), 1)
        self.assertEqual(parsed.items[0]["article"], "A2")

    def test_upsert_handles_many_rows(self):
        rows = [
            self._sample_row(article=f"ART-{idx}", name=f"Деталь {idx}", price=1000 + idx)
            for idx in range(1, 201)
        ]
        xlsx_bytes = upsert_products_to_drom_autoload(None, rows, public_base_url="")
        parsed = parse_and_validate_drom_autoload(xlsx_bytes)
        self.assertTrue(parsed.local_ok, parsed.local_errors)
        self.assertEqual(len(parsed.items), 200)

        template_path = Path(__file__).resolve().parents[1] / "app" / "templates" / "drom" / "auto-parts-GT.xlsx"
        self.assertTrue(template_path.is_file(), f"Missing template: {template_path}")


if __name__ == "__main__":
    unittest.main()
