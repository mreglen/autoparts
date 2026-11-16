import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.routers import admin_mobile_app as m


class ExpoUrlParseTests(unittest.TestCase):
    def _with_log(self, content: str):
        tmp = tempfile.TemporaryDirectory()
        log = Path(tmp.name) / "expo.log"
        log.write_text(content, encoding="utf-8")
        return tmp, log

    def test_exp_url_found(self):
        tmp, log = self._with_log("Metro waiting on exp://abc123.on.expo.app:80")
        self.addCleanup(tmp.cleanup)
        with patch.object(m, "LOG_FILE", log):
            self.assertEqual(m._find_expo_url(), "exp://abc123.on.expo.app:80")

    def test_http_tunnel_converted_to_exp(self):
        tmp, log = self._with_log("Waiting on http://xyz789.on.expo.app")
        self.addCleanup(tmp.cleanup)
        with patch.object(m, "LOG_FILE", log):
            self.assertEqual(m._find_expo_url(), "exp://xyz789.on.expo.app")

    def test_no_url_returns_none(self):
        tmp, log = self._with_log("bundling...")
        self.addCleanup(tmp.cleanup)
        with patch.object(m, "LOG_FILE", log):
            self.assertIsNone(m._find_expo_url())

    def test_missing_log_returns_none(self):
        with patch.object(m, "LOG_FILE", Path("nonexistent-dir/x.log")):
            self.assertIsNone(m._find_expo_url())


class ExpoStatusTests(unittest.TestCase):
    def test_status_not_running_without_pid(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        with patch.object(m, "PID_FILE", Path(tmp.name) / "expo.pid"), \
             patch.object(m, "LOG_FILE", Path(tmp.name) / "expo.log"):
            st = m._status()
        self.assertFalse(st["running"])
        self.assertIsNone(st["url"])

    def test_status_running_with_pid_and_url(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        pid_file = Path(tmp.name) / "expo.pid"
        log_file = Path(tmp.name) / "expo.log"
        pid_file.write_text(str(os.getpid()))
        log_file.write_text("Waiting on exp://test.on.expo.app")
        with patch.object(m, "PID_FILE", pid_file), \
             patch.object(m, "LOG_FILE", log_file), \
             patch.object(m, "_pid_alive", return_value=True), \
             patch.object(m, "MOBILE_DIR", Path(tmp.name)), \
             patch.object(m.os, "kill", create=True):
            st = m._status()
        self.assertTrue(st["running"])
        self.assertEqual(st["url"], "exp://test.on.expo.app")


if __name__ == "__main__":
    unittest.main()
