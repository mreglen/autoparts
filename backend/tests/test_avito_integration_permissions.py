import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
import app.models.organization_avito_integration  # noqa: F401
from app.models.permission import Permission
from app.models.user import User as UserModel
from app.models.user_permission import UserPermission
from app.utils.integration_access import ensure_avito_integration_access, has_avito_integration_access
from app.utils.org_access import SETTINGS_INTEGRATION_AVITO_PERMISSION_CODE


class AvitoIntegrationPermissionsTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        self._create_tables()
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.db = self.Session()
        self.org_id = "org1"
        self.perm = Permission(
            id=1,
            code=SETTINGS_INTEGRATION_AVITO_PERMISSION_CODE,
            name="Интеграция Авито",
        )
        self.db.add(self.perm)
        self.db.commit()

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
            ]:
                conn.execute(text(ddl))

    def _employee(self, *, with_permission: bool) -> UserModel:
        user = UserModel(
            id=10,
            public_code="E000000010",
            email="emp@test.local",
            is_employee=True,
            organization_id=self.org_id,
        )
        self.db.add(user)
        self.db.commit()
        if with_permission:
            self.db.add(UserPermission(user_id=user.id, permission_id=self.perm.id))
            self.db.commit()
        return user

    def test_director_has_access_without_explicit_permission(self):
        director = UserModel(
            id=2,
            public_code="D000000002",
            email="dir@test.local",
            is_director=True,
            organization_id=self.org_id,
        )
        self.assertTrue(has_avito_integration_access(self.db, director))

    def test_employee_without_permission_denied(self):
        employee = self._employee(with_permission=False)
        self.assertFalse(has_avito_integration_access(self.db, employee))
        with self.assertRaises(HTTPException) as ctx:
            ensure_avito_integration_access(self.db, employee, self.org_id)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_employee_with_permission_allowed(self):
        employee = self._employee(with_permission=True)
        self.assertTrue(has_avito_integration_access(self.db, employee))
        ensure_avito_integration_access(self.db, employee, self.org_id)


if __name__ == "__main__":
    unittest.main()
