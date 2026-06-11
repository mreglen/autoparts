import unittest
from unittest.mock import MagicMock, patch

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.schemas.server_stats import ServiceHealth
from app.services import server_stats_service as svc


class _FakeMem:
    total = 8 * 1024**3
    used = 6 * 1024**3
    available = 2 * 1024**3
    percent = 75.0


class _FakeSwap:
    total = 2 * 1024**3
    used = 512 * 1024**2
    percent = 25.0


class _FakeDiskUsage:
    total = 100 * 1024**3
    used = 50 * 1024**3
    free = 50 * 1024**3
    percent = 50.0


class _FakeProcMem:
    rss = 128 * 1024**2


class ServerStatsServiceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _patch_psutil(self, *, cpu_percent=10.0, memory_percent=75.0, disk_percent=50.0):
        fake_proc = MagicMock()
        fake_proc.pid = 12345
        fake_proc.create_time.return_value = 1_700_000_000.0
        fake_proc.memory_info.return_value = _FakeProcMem()
        fake_proc.cpu_percent.return_value = 2.5
        fake_proc.num_threads.return_value = 8
        fake_proc.oneshot.return_value.__enter__ = MagicMock(return_value=None)
        fake_proc.oneshot.return_value.__exit__ = MagicMock(return_value=False)

        fake_vm = _FakeMem()
        fake_vm.percent = memory_percent
        fake_swap = _FakeSwap()

        fake_disk = _FakeDiskUsage()
        fake_disk.percent = disk_percent

        return patch.multiple(
            svc,
            psutil=MagicMock(
                boot_time=MagicMock(return_value=1_700_000_000.0),
                cpu_count=MagicMock(side_effect=lambda logical=True: 4 if logical else 2),
                cpu_percent=MagicMock(return_value=cpu_percent),
                virtual_memory=MagicMock(return_value=fake_vm),
                swap_memory=MagicMock(return_value=fake_swap),
                disk_usage=MagicMock(return_value=fake_disk),
                disk_partitions=MagicMock(return_value=[]),
                Process=MagicMock(return_value=fake_proc),
            ),
            _load_averages=MagicMock(return_value=(1.2, 1.0, 0.8)),
            _read_os_version=MagicMock(return_value="Ubuntu 22.04.5 LTS"),
            _check_postgresql=MagicMock(
                return_value=ServiceHealth(name="PostgreSQL", ok=True, latency_ms=1.0)
            ),
            _check_redis=MagicMock(
                return_value=ServiceHealth(name="Redis", ok=True, latency_ms=2.0)
            ),
            _check_celery=MagicMock(
                return_value=ServiceHealth(
                    name="Celery worker", ok=True, latency_ms=3.0, detail="1 worker(s)"
                )
            ),
        )

    def test_collect_server_stats_structure(self):
        with self._patch_psutil():
            result = svc.collect_server_stats(self.db)

        self.assertEqual(result.hostname, svc.socket.gethostname())
        self.assertEqual(result.os_version, "Ubuntu 22.04.5 LTS")
        self.assertEqual(result.cpu.cores_logical, 4)
        self.assertEqual(result.cpu.cores_physical, 2)
        self.assertEqual(result.cpu.usage_percent, 10.0)
        self.assertEqual(result.cpu.load_avg_1m, 1.2)
        self.assertEqual(result.memory.percent, 75.0)
        self.assertEqual(result.process.pid, 12345)
        self.assertEqual(len(result.services), 3)
        self.assertTrue(all(service.ok for service in result.services))

    def test_warnings_on_high_load(self):
        with self._patch_psutil(cpu_percent=90.0, memory_percent=90.0, disk_percent=95.0):
            result = svc.collect_server_stats(self.db)

        self.assertTrue(any("CPU" in warning for warning in result.warnings))
        self.assertTrue(any("RAM" in warning for warning in result.warnings))
        self.assertTrue(any("Диск" in warning for warning in result.warnings))

    def test_load_average_unavailable(self):
        with self._patch_psutil():
            with patch.object(svc, "_load_averages", return_value=(None, None, None)):
                result = svc.collect_server_stats(self.db)

        self.assertIsNone(result.cpu.load_avg_1m)
        self.assertFalse(any("Load average" in warning for warning in result.warnings))

    def test_postgresql_health_check(self):
        with patch.object(svc, "time") as mock_time:
            mock_time.perf_counter.side_effect = [0.0, 0.012]
            health = svc._check_postgresql(self.db)
        self.assertTrue(health.ok)
        self.assertEqual(health.latency_ms, 12.0)

    def test_postgresql_health_check_failure(self):
        db = MagicMock()
        db.execute.side_effect = RuntimeError("connection refused")
        health = svc._check_postgresql(db)
        self.assertFalse(health.ok)
        self.assertIn("connection refused", health.detail or "")


if __name__ == "__main__":
    unittest.main()
