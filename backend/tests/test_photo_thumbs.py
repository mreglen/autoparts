import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from app.services.product_photo_thumbs import (
    generate_thumbs,
    get_thumbs_stats,
    resolve_photo_disk_path,
)
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
        self.assertEqual(
            build_thumb_media_path("/temp/org/file.jpg"),
            "/temp/org/file_thumb.webp",
        )


class ResolvePhotoDiskPathTests(unittest.TestCase):
    def test_resolve_uploads_and_temp(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            uploads = base / "uploads"
            (uploads / "pictures" / "org").mkdir(parents=True)
            (uploads / "temp" / "org").mkdir(parents=True)
            pic = uploads / "pictures" / "org" / "a.webp"
            temp = uploads / "temp" / "org" / "b.jpg"
            pic.write_bytes(b"webp")
            temp.write_bytes(b"jpg")

            self.assertEqual(
                resolve_photo_disk_path("/uploads/pictures/org/a.webp", base),
                pic.resolve(),
            )
            self.assertEqual(
                resolve_photo_disk_path("/temp/org/b.jpg", base),
                temp.resolve(),
            )
            self.assertIsNone(resolve_photo_disk_path("https://cdn.example/x.jpg", base))
            self.assertIsNone(resolve_photo_disk_path("/uploads/missing.webp", base))


class GenerateThumbsServiceTests(unittest.TestCase):
    def _photo(self, pid, url, thumb=None):
        photo = MagicMock()
        photo.id = pid
        photo.photo_url = url
        photo.thumb_url = thumb
        return photo

    def test_missing_links_existing_thumb_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            folder = base / "uploads" / "pictures" / "org"
            folder.mkdir(parents=True)
            src = folder / "a.webp"
            thumb = folder / "a_thumb.webp"
            src.write_bytes(b"full")
            thumb.write_bytes(b"thumb")

            photo = self._photo(1, "/uploads/pictures/org/a.webp")
            db = MagicMock()
            query = MagicMock()
            db.query.return_value = query
            query.order_by.return_value = query
            query.filter.return_value = query
            query.limit.return_value = query
            query.all.return_value = [photo]

            with patch("app.services.product_photo_thumbs.optimize_image") as opt:
                result = generate_thumbs(
                    db,
                    mode="missing",
                    limit=10,
                    batch_size=10,
                    base_dir=base,
                    invalidate_cache=False,
                )
                opt.assert_not_called()

            self.assertEqual(result.processed, 1)
            self.assertEqual(result.linked_existing_file, 1)
            self.assertEqual(result.created, 0)
            self.assertEqual(photo.thumb_url, "/uploads/pictures/org/a_thumb.webp")
            db.commit.assert_called()

    def test_force_recreates_thumb(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            folder = base / "uploads" / "temp" / "org"
            folder.mkdir(parents=True)
            src = folder / "b.jpg"
            src.write_bytes(b"jpeg-bytes")

            photo = self._photo(7, "/temp/org/b.jpg", thumb="/temp/org/old_thumb.webp")
            db = MagicMock()
            query = MagicMock()
            db.query.return_value = query
            query.order_by.return_value = query
            query.filter.return_value = query
            query.limit.return_value = query
            query.all.return_value = [photo]

            with patch(
                "app.services.product_photo_thumbs.optimize_image",
                return_value=b"WEBPTHUMB",
            ) as opt:
                result = generate_thumbs(
                    db,
                    mode="force",
                    limit=5,
                    batch_size=5,
                    base_dir=base,
                    invalidate_cache=False,
                )
                opt.assert_called_once()

            thumb_path = folder / "b_thumb.webp"
            self.assertTrue(thumb_path.is_file())
            self.assertEqual(thumb_path.read_bytes(), b"WEBPTHUMB")
            self.assertEqual(result.created, 1)
            self.assertEqual(photo.thumb_url, "/temp/org/b_thumb.webp")

    def test_stats_counts(self):
        db = MagicMock()
        call_n = {"i": 0}
        scalars = [10, 4, 2, 3]  # total, with_thumb, external, missing

        def query_factory(*_a, **_k):
            q = MagicMock()
            q.filter.return_value = q

            def scalar():
                idx = call_n["i"]
                call_n["i"] += 1
                return scalars[idx] if idx < len(scalars) else 0

            q.scalar.side_effect = scalar
            return q

        db.query.side_effect = query_factory
        stats = get_thumbs_stats(db)
        self.assertEqual(stats.total, 10)
        self.assertEqual(stats.with_thumb, 4)
        self.assertEqual(stats.external_skipped, 2)
        self.assertEqual(stats.missing_thumb, 3)


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
