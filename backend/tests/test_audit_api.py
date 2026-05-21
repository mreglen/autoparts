import unittest
from datetime import date, datetime, timezone

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
import app.models.organization_avito_integration  # noqa: F401
import app.models.organization_drom_integration  # noqa: F401
from app.models.event_log import EventLog
from app.models.permission import Permission
from app.models.user import User as UserModel
from app.models.user_permission import UserPermission
from app.services.audit_service import AuditListFilters, has_audit_access, list_audit_events, log_audit
from app.utils.org_access import ADMIN_AUDIT_PERMISSION_CODE, org_has_admin_director


class AuditApiTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        self._create_tables()
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.db = self.Session()
        self._seed()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _create_tables(self):
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    CREATE TABLE permissions (
                        id INTEGER PRIMARY KEY,
                        code VARCHAR(50) UNIQUE,
                        name VARCHAR(100)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
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
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE user_permissions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER,
                        permission_id INTEGER
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
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
                )
            )

    def _seed(self):
        self.admin = UserModel(
            id=1,
            public_code="1000001",
            email="admin@test.ru",
            is_admin=True,
            organization_id="ORG1",
        )
        self.auditor = UserModel(
            id=2,
            public_code="1000002",
            email="auditor@test.ru",
            is_employee=True,
            organization_id="ORG1",
        )
        self.other = UserModel(
            id=3,
            public_code="1000003",
            email="other@test.ru",
            is_employee=True,
            organization_id="ORG1",
        )
        self.db.add_all([self.admin, self.auditor, self.other])
        perm = Permission(id=1, code=ADMIN_AUDIT_PERMISSION_CODE, name="Журнал событий")
        self.db.add(perm)
        self.db.add(UserPermission(user_id=2, permission_id=1))
        self.db.commit()

        log_audit(
            self.db,
            event_type="user_logged_in",
            category="auth",
            summary="Login A",
            user_id=1,
            email="admin@test.ru",
            organization_id="ORG1",
        )
        log_audit(
            self.db,
            event_type="stock_out_created",
            category="warehouse",
            summary="Stock out B",
            organization_id="ORG2",
        )

    def test_admin_has_access(self):
        self.assertTrue(has_audit_access(self.db, self.admin))

    def test_employee_with_permission_has_access(self):
        self.assertTrue(has_audit_access(self.db, self.auditor))

    def test_employee_without_permission_denied(self):
        self.assertFalse(has_audit_access(self.db, self.other))

    def test_list_all_events_for_auditor_scope(self):
        rows, total = list_audit_events(self.db, AuditListFilters(), page=1, limit=50)
        self.assertEqual(total, 2)
        self.assertEqual(len(rows), 2)

    def test_filter_by_category(self):
        rows, total = list_audit_events(
            self.db, AuditListFilters(category="warehouse"), page=1, limit=50
        )
        self.assertEqual(total, 1)
        self.assertEqual(rows[0].event_type, "stock_out_created")

    def test_search_filter(self):
        rows, total = list_audit_events(
            self.db, AuditListFilters(search="Login"), page=1, limit=50
        )
        self.assertEqual(total, 1)
        self.assertIn("Login", rows[0].summary)


if __name__ == "__main__":
    unittest.main()
