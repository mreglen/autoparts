import unittest

from app.services.avito_media import product_photo_urls_for_avito_export


class AvitoMediaTests(unittest.TestCase):
    def test_export_skips_external_avito_urls(self):
        urls = product_photo_urls_for_avito_export(
            [
                "https://img.avito.st/image/1/1.jpg",
                "/pictures/org1/photo.webp",
                "https://svoygarage.ru/pictures/org1/other.webp",
            ]
        )
        self.assertEqual(len(urls), 2)
        self.assertTrue(all("pictures/" in u for u in urls))
        self.assertFalse(any("avito" in u for u in urls))

    def test_export_empty_when_only_external(self):
        self.assertEqual(
            product_photo_urls_for_avito_export(["https://img.avito.st/image/1/1.jpg"]),
            [],
        )


if __name__ == "__main__":
    unittest.main()
