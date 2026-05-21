import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.models.permission import Permission
from app.models.user import User as UserModel
from app.models.user_permission import UserPermission
from app.utils.org_access import ADMIN_AUDIT_PERMISSION_CODE, org_has_admin_director


def _filter_permissions_for_user(db, permissions, current_user):
    if current_user.is_admin:
        return permissions
    if not org_has_admin_director(db, current_user.organization_id):
        return [p for p in permissions if p.code != ADMIN_AUDIT_PERMISSION_CODE]
    return permissions


def _validate_audit_permission_assign(db, current_user, permission_ids):
    audit_perm = db.query(Permission).filter(Permission.code == ADMIN_AUDIT_PERMISSION_CODE).first()
    if audit_perm and audit_perm.id in permission_ids:
        if not org_has_admin_director(db, current_user.organization_id):
            raise HTTPException(
                status_code=403,
                detail="Право «Журнал событий» доступно только в организациях с admin-директором",
            )


class AuditPermissionsTests(unittest.TestCase):
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
            for ddl in [
                """
                CREATE TABLE permissions (
                    id INTEGER PRIMARY KEY,
                    code VARCHAR(50) UNIQUE,
                    name VARCHAR(100)
                )
                """,
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
                """,
                """
                CREATE TABLE user_permissions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    permission_id INTEGER
                )
                """,
                """
                CREATE TABLE user_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    is_active BOOLEAN
                )
                """,
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
                """,
            ]:
                conn.execute(text(ddl))

    def _seed(self):
        self.audit_perm = Permission(id=10, code=ADMIN_AUDIT_PERMISSION_CODE, name="Журнал")
        self.other_perm = Permission(id=11, code="my-parts", name="Запчасти")
        self.db.add_all([self.audit_perm, self.other_perm])

        self.admin_director = UserModel(
            id=1,
            public_code="1000001",
            email="dir@test.ru",
            is_director=True,
            is_admin=True,
            organization_id="ORG_ADMIN",
        )
        self.director_plain = UserModel(
            id=2,
            public_code="1000002",
            email="plain@test.ru",
            is_director=True,
            is_admin=False,
            organization_id="ORG_PLAIN",
        )
        self.employee = UserModel(
            id=3,
            public_code="1000003",
            email="emp@test.ru",
            is_employee=True,
            organization_id="ORG_PLAIN",
        )
        self.db.add_all([self.admin_director, self.director_plain, self.employee])
        self.db.commit()

    def test_org_has_admin_director(self):
        self.assertTrue(org_has_admin_director(self.db, "ORG_ADMIN"))
        self.assertFalse(org_has_admin_director(self.db, "ORG_PLAIN"))

    def test_audit_permission_hidden_for_plain_org(self):
        perms = [self.audit_perm, self.other_perm]
        filtered = _filter_permissions_for_user(self.db, perms, self.director_plain)
        codes = {p.code for p in filtered}
        self.assertNotIn(ADMIN_AUDIT_PERMISSION_CODE, codes)
        self.assertIn("my-parts", codes)

    def test_audit_permission_visible_for_admin_director_org(self):
        perms = [self.audit_perm, self.other_perm]
        filtered = _filter_permissions_for_user(self.db, perms, self.admin_director)
        codes = {p.code for p in filtered}
        self.assertIn(ADMIN_AUDIT_PERMISSION_CODE, codes)

    def test_assign_audit_permission_rejected_for_plain_org(self):
        with self.assertRaises(HTTPException) as ctx:
            _validate_audit_permission_assign(self.db, self.director_plain, [10])
        self.assertEqual(ctx.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
