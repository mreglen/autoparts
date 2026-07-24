import gzip
import tarfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from app.services import backup_service


class BackupServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = backup_service.get_backup_dir()
        for path in self.temp_dir.glob("*"):
            if path.is_file():
                path.unlink()

    def test_build_and_parse_filename(self):
        filename = backup_service._build_filename("db", "manual")
        self.assertTrue(filename.startswith("db-manual-"))
        self.assertTrue(filename.endswith(".sql.gz"))

        path = self.temp_dir / filename
        path.write_bytes(b"test")
        item = backup_service._parse_backup_filename(filename)
        self.assertIsNotNone(item)
        self.assertEqual(item.backup_type, "db")
        self.assertEqual(item.trigger, "manual")

    def test_resolve_backup_path_rejects_traversal(self):
        with self.assertRaises(ValueError):
            backup_service.resolve_backup_path("../secret.sql.gz")

    def test_create_uploads_backup_archives_files(self):
        uploads_root = backup_service.get_uploads_dir()
        uploads_root.mkdir(parents=True, exist_ok=True)
        sample = uploads_root / "pictures" / "org1"
        sample.mkdir(parents=True, exist_ok=True)
        (sample / "photo.webp").write_bytes(b"webp")

        item = backup_service.create_uploads_backup(trigger="manual")
        self.assertEqual(item.backup_type, "uploads")
        archive_path = backup_service.resolve_backup_path(item.id)
        with tarfile.open(archive_path, "r:gz") as archive:
            names = archive.getnames()
        self.assertIn("uploads/pictures/org1/photo.webp", names)

    @patch("app.services.backup_service.subprocess.Popen")
    @patch("app.services.backup_service._ensure_pg_dump_available", return_value="/usr/bin/pg_dump")
    @patch("app.services.backup_service._database_url_supports_backup", return_value=True)
    def test_create_database_backup_uses_pg_dump(self, _supports, _pg_dump, mock_popen):
        process = MagicMock()
        process.stdout = MagicMock()
        process.stdout.read.side_effect = [b"SELECT 1;", b""]
        process.stderr = MagicMock()
        process.stderr.read.return_value = b""
        process.wait.return_value = 0
        mock_popen.return_value = process

        item = backup_service.create_database_backup(trigger="manual")
        self.assertEqual(item.backup_type, "db")
        path = backup_service.resolve_backup_path(item.id)
        with gzip.open(path, "rb") as gz_file:
            content = gz_file.read()
        self.assertEqual(content, b"SELECT 1;")

    def test_start_backup_job_completes(self):
        with patch.object(backup_service, "create_uploads_backup") as mock_create:
            mock_create.return_value = backup_service.BackupItem(
                id="uploads-manual-20260101-000000.tar.gz",
                backup_type="uploads",
                trigger="manual",
                filename="uploads-manual-20260101-000000.tar.gz",
                size_bytes=10,
                created_at="2026-01-01T00:00:00+00:00",
            )
            job = backup_service.start_backup_job("uploads", trigger="manual")
            self.assertEqual(job["status"], "running")
            for _ in range(50):
                current = backup_service.get_backup_job(job["id"])
                if current and current["status"] != "running":
                    break
                import time

                time.sleep(0.05)
            current = backup_service.get_backup_job(job["id"])
            self.assertIsNotNone(current)
            self.assertEqual(current["status"], "done")

    def test_cleanup_old_backups_keeps_recent(self):
        now = datetime.now(timezone.utc)
        for index in range(3):
            filename = backup_service._build_filename(
                "db",
                "scheduled",
                now=now - timedelta(minutes=index),
            )
            (self.temp_dir / filename).write_bytes(b"x")
        removed = backup_service.cleanup_old_backups(retention=2)
        self.assertEqual(removed["db"], 1)
        remaining = [item for item in backup_service.list_backups() if item.backup_type == "db"]
        self.assertEqual(len(remaining), 2)


if __name__ == "__main__":
    unittest.main()
