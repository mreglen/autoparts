import sys
import types
import unittest
from datetime import datetime, timedelta

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base
from app.models.autoservice_work_zone import AutoserviceWorkZone
from app.services.autoservice_work_zone_helpers import (
    next_work_zone_name,
    validate_schedule_end,
    validate_work_zone_id,
)


class AutoserviceWorkZoneHelperTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            bind=self.engine,
            tables=[AutoserviceWorkZone.__table__],
        )
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()

    def test_next_work_zone_name_auto_numbering(self):
        self.db.add(
            AutoserviceWorkZone(
                organization_id="ORG1",
                name="Рабочая зона №1",
                sort_order=1,
                is_active=True,
            )
        )
        self.db.commit()
        name, sort_order = next_work_zone_name(self.db, "ORG1")
        self.assertEqual(name, "Рабочая зона №2")
        self.assertEqual(sort_order, 2)

    def test_validate_work_zone_id_rejects_missing(self):
        with self.assertRaises(HTTPException):
            validate_work_zone_id(self.db, "ORG1", 999)

    def test_validate_work_zone_id_accepts_active(self):
        zone = AutoserviceWorkZone(
            organization_id="ORG1",
            name="Рабочая зона №1",
            sort_order=1,
            is_active=True,
        )
        self.db.add(zone)
        self.db.commit()
        result = validate_work_zone_id(self.db, "ORG1", zone.id)
        self.assertEqual(result, zone.id)

    def test_validate_schedule_end_requires_after_start(self):
        start = datetime(2026, 8, 11, 10, 0, 0)
        end = datetime(2026, 8, 11, 9, 0, 0)
        with self.assertRaises(HTTPException):
            validate_schedule_end(start, end)

    def test_validate_schedule_end_allows_none(self):
        start = datetime(2026, 8, 11, 10, 0, 0)
        self.assertIsNone(validate_schedule_end(start, None))

    def test_validate_schedule_end_accepts_valid_range(self):
        start = datetime(2026, 8, 11, 10, 0, 0)
        end = start + timedelta(hours=2)
        self.assertEqual(validate_schedule_end(start, end), end)


if __name__ == "__main__":
    unittest.main()
