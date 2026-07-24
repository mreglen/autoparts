import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.services.marketplace_site_footer import (
    FOOTER_MARKER,
    append_marketplace_site_info,
    build_marketplace_site_footer,
)


class MarketplaceSiteFooterTests(unittest.TestCase):
    def test_disabled_returns_original(self):
        product = SimpleNamespace(id=16, brand="MANN", article="IF1009")
        self.assertEqual(
            append_marketplace_site_info("База", enabled=False, product=product),
            "База",
        )

    def test_appends_footer_with_product_url(self):
        product = SimpleNamespace(id=16, brand="MANN", article="IF1009")
        with patch(
            "app.services.marketplace_site_footer.resolve_public_site_origin",
            return_value="https://svoygarage.ru",
        ):
            result = append_marketplace_site_info(
                "Описание товара.",
                enabled=True,
                product=product,
            )
        self.assertTrue(result.startswith("Описание товара."))
        self.assertIn("https://svoygarage.ru/part/16-MANN-IF1009", result)
        self.assertIn("Свой Гараж", result)
        self.assertIn(FOOTER_MARKER, result.casefold())

    def test_does_not_duplicate_footer(self):
        product = SimpleNamespace(id=1, brand="A", article="B")
        footer = build_marketplace_site_footer(product_url="https://svoygarage.ru/part/1-A-B")
        once = f"Текст\n\n{footer}"
        with patch(
            "app.services.marketplace_site_footer.resolve_public_site_origin",
            return_value="https://svoygarage.ru",
        ):
            twice = append_marketplace_site_info(once, enabled=True, product=product)
        self.assertEqual(twice, once.rstrip())

    def test_footer_has_no_emoji(self):
        text = build_marketplace_site_footer(product_url="https://svoygarage.ru/part/1")
        self.assertNotRegex(text, r"[\U0001F300-\U0001FAFF]")


if __name__ == "__main__":
    unittest.main()
