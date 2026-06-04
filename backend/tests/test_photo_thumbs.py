import unittest
from unittest.mock import MagicMock

from app.utils.photo_thumb_paths import (
    build_thumb_filename,
    build_thumb_media_path,
)
from app.utils.product_list_item import map_product_to_list_item


class PhotoThumbHelpersTests(unittest.TestCase):
    def test_build_thumb_paths(self):
        self.assertEqual(
            build_thumb_filename("org_20250101_120000_part.webp"),
            "org_20250101_120000_part_thumb.webp",
        )
        self.assertEqual(
            build_thumb_media_path("/uploads/pictures/org/file.webp"),
            "/uploads/pictures/org/file_thumb.webp",
        )


class ProductListItemMapperTests(unittest.TestCase):
    def test_map_without_thumb_falls_back_to_photo_url(self):
        photo = MagicMock()
        photo.id = 1
        photo.photo_url = "/uploads/pictures/org/a.webp"
        photo.thumb_url = None
        photo.full_url = "/uploads/pictures/org/a.webp"
        photo.list_photo_url = "/uploads/pictures/org/a.webp"

        product = MagicMock()
        product.id = 10
        product.brand = "Bosch"
        product.article = "ABC"
        product.name = "Filter"
        product.price = 100.0
        product.quantity = 2
        product.is_new = False
        product.organization_id = "org-1"
        product.storage_location_id = 1
        product.created_at = None
        product.photos = [photo]
        product.organization = None
        product.storage_location = None

        item = map_product_to_list_item(product)
        self.assertEqual(item.list_photo_url, "/uploads/pictures/org/a.webp")
        self.assertEqual(len(item.photos), 1)
        self.assertEqual(item.photos[0].list_photo_url, "/uploads/pictures/org/a.webp")

    def test_map_uses_thumb_when_present(self):
        photo = MagicMock()
        photo.id = 2
        photo.photo_url = "/uploads/pictures/org/a.webp"
        photo.thumb_url = "/uploads/pictures/org/a_thumb.webp"
        photo.full_url = "/uploads/pictures/org/a.webp"
        photo.list_photo_url = "/uploads/pictures/org/a_thumb.webp"

        product = MagicMock()
        product.id = 11
        product.brand = "MANN"
        product.article = "W712"
        product.name = "Oil filter"
        product.price = 500.0
        product.quantity = 1
        product.is_new = True
        product.organization_id = "org-1"
        product.storage_location_id = 1
        product.created_at = None
        product.photos = [photo]
        product.organization = None
        product.storage_location = None

        item = map_product_to_list_item(product)
        self.assertEqual(item.list_photo_url, "/uploads/pictures/org/a_thumb.webp")


if __name__ == "__main__":
    unittest.main()
