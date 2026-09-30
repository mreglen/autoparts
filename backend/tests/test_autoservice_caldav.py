import json
import sys
import tempfile
import types
import unittest
from datetime import date, time
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

import app.models  # noqa: F401

from fastapi import HTTPException

from app.models.caldav_account import CaldavAccount
from app.services import autoservice_caldav as caldav

MOD = "app.services.autoservice_caldav"


def _booking(**kw):
    data = dict(
        id=7,
        organization_id="ORG1",
        name="Иван Петров",
        phone="+79991234567",
        preferred_date=date(2026, 10, 5),
        preferred_time=time(11, 0),
        vehicle_make="BMW",
        vehicle_model="X5",
        status="confirmed",
        notes="Осмотр подвески",
    )
    data.update(kw)
    return SimpleNamespace(**data)


def _org(address="ул Фруктовая, д 17"):
    return SimpleNamespace(id="ORG1", name="Свой Гараж", address=address)


class EventIcsTests(unittest.TestCase):
    def test_timed_event_structure(self):
        ics = caldav.build_event_ics(_booking(), _org())
        self.assertIn("BEGIN:VEVENT", ics)
        self.assertIn("UID:booking-7-event@svoygarage", ics)
        self.assertIn("DTSTART;TZID=Asia/Yekaterinburg:20261005T110000", ics)
        self.assertIn("DTEND;TZID=Asia/Yekaterinburg:20261005T120000", ics)
        self.assertIn("SUMMARY:Осмотр: Иван Петров — BMW X5", ics)
        self.assertIn("LOCATION:ул Фруктовая\\, д 17", ics)
        self.assertIn("TRIGGER:-PT15M", ics)
        self.assertIn("TRIGGER:-PT1H", ics)
        # накануне 20:00 — за 15 часов до начала 11:00
        self.assertIn("TRIGGER:-PT15H", ics)
        self.assertNotIn("VALUE=DATE-TIME", ics)
        self.assertEqual(ics.count("BEGIN:VALARM"), 3)

    def test_allday_event_without_time(self):
        ics = caldav.build_event_ics(_booking(preferred_time=None), _org())
        self.assertIn("DTSTART;VALUE=DATE:20261005", ics)
        self.assertIn("DTEND;VALUE=DATE:20261006", ics)
        # накануне 20:00 — за 4 часа до полуночи
        self.assertIn("TRIGGER:-PT4H", ics)
        # утро записи 9:00 — через 9 часов после полуночи
        self.assertIn("TRIGGER:PT9H", ics)
        self.assertNotIn("VALUE=DATE-TIME", ics)

    def test_escaping(self):
        ics = caldav.build_event_ics(_booking(name="Пётр; Иван, жжёт"), _org())
        self.assertIn(r"Пётр\; Иван\, жжёт", ics)


class TodoIcsTests(unittest.TestCase):
    def test_todo_needs_action(self):
        ics = caldav.build_todo_ics(_booking(), _org())
        self.assertIn("BEGIN:VTODO", ics)
        self.assertIn("UID:booking-7-todo@svoygarage", ics)
        self.assertIn("DUE;TZID=Asia/Yekaterinburg:20261005T110000", ics)
        self.assertIn("STATUS:NEEDS-ACTION", ics)
        self.assertIn("TRIGGER:-PT15M", ics)

    def test_todo_completed(self):
        ics = caldav.build_todo_ics(_booking(status="processed"), _org())
        self.assertIn("STATUS:COMPLETED", ics)
        self.assertIn("COMPLETED:", ics)


def _db(bookings, org=None):
    db = MagicMock()
    q = MagicMock()
    q.filter.return_value = q
    q.all.return_value = bookings
    q.first.return_value = org
    db.query.return_value = q
    return db


def _account():
    acc = MagicMock(spec=CaldavAccount)
    acc.user_id = 5
    acc.organization_id = "ORG1"
    acc.caldav_username = "u5"
    return acc


class SyncAccountTests(unittest.TestCase):
    def test_writes_and_deletes_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            acc = _account()
            db = _db([_booking()], _org())
            result = caldav.sync_account(db, acc, storage_dir=tmp)
            self.assertEqual(result["bookings"], 1)

            events_dir = Path(tmp) / "u5" / "inspection-events"
            tasks_dir = Path(tmp) / "u5" / "inspection-tasks"
            self.assertTrue((events_dir / "b7-event.ics").exists())
            self.assertTrue((tasks_dir / "b7-todo.ics").exists())
            props = json.loads((events_dir / ".Radicale.props").read_text("utf-8"))
            self.assertIn("VEVENT", props["C:supported-calendar-component-set"])

            # запись удалили на сайте → файл пропал
            db2 = _db([], _org())
            caldav.sync_account(db2, acc, storage_dir=tmp)
            self.assertFalse((events_dir / "b7-event.ics").exists())
            self.assertFalse((tasks_dir / "b7-todo.ics").exists())

    def test_cancelled_not_synced(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = _db([], _org())
            result = caldav.sync_account(db, _account(), storage_dir=tmp)
            self.assertEqual(result["bookings"], 0)


class ProvisionTests(unittest.TestCase):
    def _db_no_account(self):
        db = MagicMock()
        q = MagicMock()
        q.filter.return_value = q
        q.first.return_value = None
        q.all.return_value = []
        db.query.return_value = q
        return db

    def test_disabled_raises_503(self):
        db = self._db_no_account()
        with patch(f"{MOD}.settings") as st:
            st.CALDAV_SYNC_ENABLED = False
            with self.assertRaises(HTTPException) as ctx:
                caldav.provision_account(db, MagicMock(id=5), "ORG1")
        self.assertEqual(ctx.exception.status_code, 503)

    def test_provision_writes_htpasswd_and_account(self):
        with tempfile.TemporaryDirectory() as tmp:
            htuser = str(Path(tmp) / "users")
            db = self._db_no_account()
            user = MagicMock(id=5)
            with patch(f"{MOD}.settings") as st:
                st.CALDAV_SYNC_ENABLED = True
                account, password = caldav.provision_account(
                    db, user, "ORG1", storage_dir=tmp, htuser_file=htuser
                )
            self.assertEqual(account.caldav_username, "u5")
            content = Path(htuser).read_text("utf-8")
            self.assertIn("u5:", content)
            self.assertTrue(password)

    def test_disconnect_removes_htpasswd_and_storage(self):
        with tempfile.TemporaryDirectory() as tmp:
            htuser = str(Path(tmp) / "users")
            Path(htuser).write_text("u5:hash\nother:h2\n", "utf-8")
            user_dir = Path(tmp) / "u5"
            (user_dir / "inspection-events").mkdir(parents=True)
            (user_dir / "inspection-events" / "x.ics").write_text("x", "utf-8")

            acc = _account()
            db = MagicMock()
            caldav.disconnect_account(db, acc, storage_dir=tmp, htuser_file=htuser)

            content = Path(htuser).read_text("utf-8")
            self.assertNotIn("u5:", content)
            self.assertIn("other:", content)
            self.assertFalse(user_dir.exists())


if __name__ == "__main__":
    unittest.main()
