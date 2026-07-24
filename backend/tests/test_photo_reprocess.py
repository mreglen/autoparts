import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from app.services.product_photo_reprocess import (
    enqueue_photo_reprocess,
    get_reprocess_stats,
    reprocess_stuck_photos,
    resolve_temp_disk_path,
)


class ResolveTempPathTests(unittest.TestCase):
    def test_resolve_temp_and_uploads_temp(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            folder = base / "uploads" / "temp" / "org1"
            folder.mkdir(parents=True)
            f = folder / "a.jpg"
            f.write_bytes(b"jpg")
            self.assertEqual(
                resolve_temp_disk_path("/temp/org1/a.jpg", base),
                f.resolve(),
            )
            self.assertEqual(
                resolve_temp_disk_path("/uploads/temp/org1/a.jpg", base),
                f.resolve(),
            )
            self.assertIsNone(resolve_temp_disk_path("/pictures/org1/a.webp", base))


class ReprocessServiceTests(unittest.TestCase):
    def test_enqueue_sets_processing_and_calls_celery(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            folder = base / "uploads" / "temp" / "org1"
            folder.mkdir(parents=True)
            (folder / "shot.jpg").write_bytes(b"data")

            photo = MagicMock()
            photo.id = 11
            photo.photo_url = "/temp/org1/shot.jpg"
            photo.product_id = 99
            photo.organization_id = "org1"
            photo.processing_status = "pending"

            product = MagicMock()
            product.organization_id = "org1"

            db = MagicMock()

            def query_side_effect(model):
                q = MagicMock()
                name = getattr(model, "__name__", str(model))
                if "Product" in name and "Photo" not in name:
                    q.filter.return_value.first.return_value = product
                else:
                    # Organization / User watermark lookups
                    q.filter.return_value.first.return_value = None
                return q

            db.query.side_effect = query_side_effect

            task = MagicMock()
            task.id = "task-abc"
            with patch(
                "app.services.product_photo_reprocess.process_and_upload_photo"
            ) as celery_task:
                celery_task.delay.return_value = task
                ok, task_id, err = enqueue_photo_reprocess(db, photo, base_dir=base)

            self.assertTrue(ok)
            self.assertEqual(task_id, "task-abc")
            self.assertIsNone(err)
            self.assertEqual(photo.processing_status, "processing")
            celery_task.delay.assert_called_once()

    def test_reprocess_skips_missing_file(self):
        photo = MagicMock()
        photo.id = 5
        photo.photo_url = "/temp/org1/missing.jpg"
        photo.product_id = 1
        photo.organization_id = "org1"

        db = MagicMock()
        query = MagicMock()
        db.query.return_value = query
        query.order_by.return_value = query
        query.filter.return_value = query
        query.limit.return_value = query
        query.all.return_value = [photo]

        with tempfile.TemporaryDirectory() as tmp:
            result = reprocess_stuck_photos(
                db,
                limit=10,
                base_dir=Path(tmp),
                only_temp=True,
                invalidate_cache=False,
            )

        self.assertEqual(result.processed, 1)
        self.assertEqual(result.queued, 0)
        self.assertEqual(result.skipped, 1)
        self.assertTrue(any(f.reason == "temp_file_not_found" for f in result.failures))

    def test_stats_counts(self):
        db = MagicMock()
        call_n = {"i": 0}
        scalars = [100, 40, 25, 45]

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
        stats = get_reprocess_stats(db)
        self.assertEqual(stats.total_photos, 100)
        self.assertEqual(stats.temp_url, 40)
        self.assertEqual(stats.unfinished_status, 25)
        self.assertEqual(stats.reprocess_candidates, 45)


if __name__ == "__main__":
    unittest.main()
