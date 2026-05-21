import unittest

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
import app.models.organization_avito_integration  # noqa: F401
import app.models.organization_drom_integration  # noqa: F401
from app.models.event_log import EventLog
from app.models.organization import Organization
from app.models.user import User as UserModel
from app.services.audit_service import (
    AuditListFilters,
    events_to_dicts,
    list_audit_events,
    log_audit,
    resolve_user_ids_for_filter,
    search_audit_hints,
    search_organizations,
    search_users_for_audit,
)

USERS_DDL = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    public_code VARCHAR(10) NOT NULL UNIQUE,
    last_name VARCHAR(100),
    first_name VARCHAR(100),
    patronymic VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    is_buyer BOOLEAN,
    is_seller BOOLEAN,
    is_admin BOOLEAN,
    is_director BOOLEAN,
    is_employee BOOLEAN,
    hashed_password VARCHAR,
    organization_id VARCHAR(10)
)
"""

ORGS_DDL = """
CREATE TABLE organizations (
    id VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255),
    address TEXT,
    phone VARCHAR(20),
    logo_organization TEXT,
    description TEXT,
    watermark INTEGER,
    new_parts_markup_percent REAL,
    new_parts_markup_manual BOOLEAN
)
"""

EVENT_LOG_DDL = """
CREATE TABLE event_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type VARCHAR(50) NOT NULL,
    user_id INTEGER,
    email VARCHAR,
    details TEXT,
    created_at DATETIME,
    organization_id VARCHAR(10),
    category VARCHAR(50),
    summary VARCHAR(500),
    actor_name VARCHAR(255),
    ip_address VARCHAR(45),
    entity_type VARCHAR(50),
    entity_id VARCHAR(64)
)
"""


class AuditUxTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        with self.engine.begin() as conn:
            conn.execute(text(ORGS_DDL))
            conn.execute(text(USERS_DDL))
            conn.execute(text(EVENT_LOG_DDL))
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.db = self.Session()

        self.db.add(Organization(id="ORG1", name="Авто Сервис"))
        self.db.add(Organization(id="ORG2", name="Запчасти Плюс"))
        self.user = UserModel(
            id=1,
            public_code="A482917",
            last_name="Иванов",
            first_name="Иван",
            patronymic="Иванович",
            email="ivan@test.ru",
            organization_id="ORG1",
        )
        self.db.add(self.user)
        self.db.commit()

        log_audit(
            self.db,
            event_type="user_logged_in",
            category="auth",
            summary="Вход в систему",
            user=self.user,
            organization_id="ORG1",
            details={"public_code": "A482917"},
        )

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_search_organizations_by_name(self):
        items = search_organizations(self.db, "Авто")
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["id"], "ORG1")

    def test_search_users_by_public_code(self):
        items = search_users_for_audit(self.db, "A482917")
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["public_code"], "A482917")

    def test_resolve_user_by_fio(self):
        ids = resolve_user_ids_for_filter(self.db, "Иванов")
        self.assertEqual(ids, [1])

    def test_filter_events_by_public_code(self):
        ids = resolve_user_ids_for_filter(self.db, "A482917")
        self.assertEqual(ids, [1])
        rows, total = list_audit_events(
            self.db,
            AuditListFilters(user_id=ids[0]),
            page=1,
            limit=50,
        )
        self.assertEqual(total, 1)

    def test_events_enriched_with_public_code_and_org_name(self):
        rows, _ = list_audit_events(self.db, AuditListFilters(), page=1, limit=10)
        enriched = events_to_dicts(self.db, rows)
        self.assertEqual(enriched[0]["user_public_code"], "A482917")
        self.assertEqual(enriched[0]["organization_name"], "Авто Сервис")

    def test_search_hints_summary(self):
        hints = search_audit_hints(self.db, "Вход", limit=10)
        self.assertTrue(any(h["value"] == "Вход в систему" for h in hints))


if __name__ == "__main__":
    unittest.main()
