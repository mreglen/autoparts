import sys
import types
import unittest
from unittest import mock

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker

from app.db.database import Base
from app.models.autoservice_contractor import AutoserviceContractor
from app.models.event_log import EventLog
from app.models.user import User
from app.routers import autoservice_contractors as contractors
from app.schemas.autoservice_contractor import (
    AutoserviceContractorCreate,
    AutoserviceContractorUpdate,
    RequisiteSetsIn,
)

ORG = "ORG1"
OTHER_ORG = "ORG2"


@compiles(JSONB, "sqlite")
def _jsonb_as_sqlite_json(element, compiler, **kw):
    return "JSON"


class AutoserviceContractorApiTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()
        self.user = User(
            public_code="PU1",
            last_name="Петров",
            first_name="Пётр",
            email="petr@example.com",
            hashed_password="x",
            is_employee=True,
            is_director=True,
        )
        self.db.add(self.user)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _create(self, name: str, **requisites):
        payload = AutoserviceContractorCreate(
            name=name,
            phone="+7 (343) 000-00-00",
            requisite_sets=RequisiteSetsIn(**requisites),
        )
        with mock.patch.object(
            contractors, "require_autoservice_settings", return_value=ORG
        ):
            return contractors.create_contractor(payload, self.db, self.user)

    def test_create_stores_all_three_requisite_sets(self):
        view = self._create(
            "Урал Стартер",
            person_type_default="legal",
            legal_name="ООО «Урал Стартер»",
            inn_legal="6658000000",
            kpp="665801001",
            ie_name="ИП Петров",
            inn_ie="665800000012",
            ogrnip="316658000000123",
            address="г. Екатеринбург, ул. Мира, 1",
        )
        row = self.db.query(AutoserviceContractor).filter_by(id=view.id).one()

        self.assertEqual(row.name, "Урал Стартер")
        self.assertEqual(row.person_type_default, "legal")
        self.assertEqual(row.legal_name, "ООО «Урал Стартер»")
        self.assertEqual(row.inn_legal, "6658000000")
        self.assertEqual(row.kpp, "665801001")
        self.assertEqual(row.ie_name, "ИП Петров")
        self.assertEqual(row.inn_ie, "665800000012")
        self.assertEqual(row.ogrnip, "316658000000123")
        self.assertEqual(view.requisite_sets.inn_legal, "6658000000")

    def test_digits_are_cleaned_and_blank_becomes_none(self):
        view = self._create("Расточка", inn_legal="66 58-00 00 00 ", legal_name="  ")
        self.assertEqual(view.requisite_sets.inn_legal, "6658000000")
        self.assertIsNone(view.requisite_sets.legal_name)
        self.assertEqual(view.requisite_sets.person_type_default, "individual")

    def test_duplicate_name_in_organization_is_rejected(self):
        self._create("Урал Стартер")
        with self.assertRaises(HTTPException) as ctx:
            self._create("Урал Стартер")
        self.assertEqual(ctx.exception.status_code, 400)

    def test_list_is_scoped_to_organization(self):
        created = self._create("Урал Стартер")
        self.db.add(
            AutoserviceContractor(
                organization_id=OTHER_ORG, name="Чужой подрядчик", is_active=True
            )
        )
        self.db.commit()

        with mock.patch.object(
            contractors, "require_any_autoservice_permission", return_value=ORG
        ):
            rows = contractors.list_contractors(False, "", self.db, self.user)

        self.assertEqual([row.name for row in rows], ["Урал Стартер"])
        self.assertEqual(rows[0].id, created.id)

    def test_update_rejects_name_of_another_contractor(self):
        first = self._create("Урал Стартер")
        second = self._create("Расточка блока")
        with mock.patch.object(
            contractors, "require_autoservice_settings", return_value=ORG
        ):
            with self.assertRaises(HTTPException) as ctx:
                contractors.update_contractor(
                    second.id,
                    AutoserviceContractorUpdate(name="Урал Стартер"),
                    self.db,
                    self.user,
                )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(self.db.query(AutoserviceContractor).count(), 2)
        self.assertEqual(first.name, "Урал Стартер")

    def test_update_can_deactivate(self):
        created = self._create("Урал Стартер")
        with mock.patch.object(
            contractors, "require_autoservice_settings", return_value=ORG
        ):
            view = contractors.update_contractor(
                created.id,
                AutoserviceContractorUpdate(is_active=False),
                self.db,
                self.user,
            )
        self.assertFalse(view.is_active)
        self.assertFalse(self.db.get(AutoserviceContractor, created.id).is_active)

    def test_patch_of_foreign_contractor_is_404(self):
        foreign = AutoserviceContractor(
            organization_id=OTHER_ORG, name="Чужой подрядчик", is_active=True
        )
        self.db.add(foreign)
        self.db.commit()
        with mock.patch.object(
            contractors, "require_autoservice_settings", return_value=ORG
        ):
            with self.assertRaises(HTTPException) as ctx:
                contractors.update_contractor(
                    foreign.id, AutoserviceContractorUpdate(name="Переименовать"), self.db, self.user
                )
        self.assertEqual(ctx.exception.status_code, 404)
        self.assertEqual(self.db.get(AutoserviceContractor, foreign.id).name, "Чужой подрядчик")


class AutoserviceContractorAuditTests(unittest.TestCase):
    def test_created_event_is_logged(self):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        db = sessionmaker(bind=engine)()
        user = User(
            public_code="PU2", last_name="Иванов", email="ivan@example.com", hashed_password="x"
        )
        db.add(user)
        db.commit()
        with mock.patch.object(
            contractors, "require_autoservice_settings", return_value=ORG
        ):
            contractors.create_contractor(
                AutoserviceContractorCreate(name="Урал Стартер"), db, user
            )
        entry = db.query(EventLog).filter_by(event_type="contractor_created").one()
        self.assertEqual(entry.category, "autoservice")
        self.assertEqual(entry.entity_type, "contractor")
        self.assertIn("Урал Стартер", entry.summary)
        db.close()
        engine.dispose()


if __name__ == "__main__":
    unittest.main()
