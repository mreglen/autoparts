import unittest

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.models.event_log import EventLog
from app.models.user import User as UserModel
from app.services.audit_service import log_audit


class AuditLoggingTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        with self.engine.begin() as conn:
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
                    CREATE TABLE event_log (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        event_type VARCHAR(50) NOT NULL,
                        user_id INTEGER,
                        email VARCHAR,
                        details TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.db = self.Session()
        self.user = UserModel(
            id=1,
            public_code="1000001",
            last_name="Test",
            first_name="User",
            email="u@test.ru",
            organization_id="ORG1",
        )
        self.db.add(self.user)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_log_audit_writes_category_and_summary(self):
        log_audit(
            self.db,
            event_type="employee_permissions_changed",
            category="employees",
            summary="Права изменены",
            user=self.user,
            organization_id="ORG1",
            details={"permission_codes": ["admin.audit"]},
        )
        row = self.db.query(EventLog).one()
        self.assertEqual(row.category, "employees")
        self.assertEqual(row.summary, "Права изменены")
        self.assertEqual(row.actor_name, "Test User")
        self.assertIn("admin.audit", row.details)


if __name__ == "__main__":
    unittest.main()
