import json
import tempfile
import unittest
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
import app.models.organization_avito_integration  # noqa: F401
import app.models.organization_drom_integration  # noqa: F401
from app.models.event_log import EventLog
from app.services.audit_service import list_user_audit_events, log_audit
from app.utils.user_avatar import (
    avatar_public_url,
    delete_avatar_files,
    resolve_user_by_contact,
    save_user_avatar_file,
)


class UserAvatarUtilsTests(unittest.TestCase):
    def test_avatar_public_url_normalizes_relative_path(self):
        self.assertEqual(avatar_public_url("/uploads/user_avatars/1/avatar.jpg"), "/uploads/user_avatars/1/avatar.jpg")
        self.assertIsNone(avatar_public_url(None))

    def test_save_and_delete_avatar_files(self):
        import os
        with tempfile.TemporaryDirectory() as tmp:
            cwd = Path.cwd()
            try:
                os.chdir(tmp)
                path = save_user_avatar_file(42, b"fake-image", ".png")
                self.assertTrue(path.endswith("/uploads/user_avatars/42/avatar.png"))
                self.assertTrue((Path("uploads") / "user_avatars" / "42" / "avatar.png").exists())
                delete_avatar_files(42)
                self.assertFalse((Path("uploads") / "user_avatars" / "42").exists())
            finally:
                os.chdir(cwd)


class ResolveUserByContactTests(unittest.TestCase):
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
                        is_buyer BOOLEAN DEFAULT 0,
                        is_seller BOOLEAN DEFAULT 0,
                        is_admin BOOLEAN DEFAULT 0,
                        is_director BOOLEAN DEFAULT 0,
                        is_employee BOOLEAN DEFAULT 0,
                        hashed_password VARCHAR,
                        organization_id VARCHAR(10),
                        avatar_url VARCHAR(512)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    INSERT INTO users (id, public_code, email, phone, avatar_url)
                    VALUES (1, 'B12345678', 'buyer@test.ru', '+7 (999) 111-22-33', '/uploads/user_avatars/1/avatar.jpg')
                    """
                )
            )
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_resolve_by_email(self):
        from app.models.user import User as UserModel

        user = resolve_user_by_contact(self.db, None, "buyer@test.ru")
        self.assertIsNotNone(user)
        self.assertIsInstance(user, UserModel)
        self.assertEqual(user.id, 1)

    def test_resolve_by_phone(self):
        user = resolve_user_by_contact(self.db, "+7 (999) 111-22-33", None)
        self.assertIsNotNone(user)
        self.assertEqual(user.id, 1)


class UserAuditListTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        with self.engine.begin() as conn:
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

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_list_user_audit_events_includes_actor_and_entity(self):
        log_audit(
            self.db,
            event_type="user_logged_in",
            category="auth",
            summary="Вход",
            user_id=5,
            entity_type="user",
            entity_id=5,
        )
        log_audit(
            self.db,
            event_type="admin_user_viewed",
            category="users",
            summary="Просмотр",
            user_id=1,
            entity_type="user",
            entity_id=5,
        )
        log_audit(
            self.db,
            event_type="order_created",
            category="orders",
            summary="Другой пользователь",
            user_id=9,
        )
        rows, total = list_user_audit_events(self.db, 5, page=1, limit=10)
        self.assertEqual(total, 2)
        types = {r.event_type for r in rows}
        self.assertIn("user_logged_in", types)
        self.assertIn("admin_user_viewed", types)


class UserAvatarAuditTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        with self.engine.begin() as conn:
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

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_avatar_upload_audit_entry(self):
        log_audit(
            self.db,
            event_type="user_avatar_uploaded",
            category="users",
            summary="Аватар обновлён",
            user_id=1,
            email="u@test.ru",
            details={
                "user_id": 1,
                "public_code": "A11111111",
                "old_avatar_url": None,
                "new_avatar_url": "/uploads/user_avatars/1/avatar.jpg",
            },
            entity_type="user",
            entity_id=1,
        )
        row = self.db.query(EventLog).filter(EventLog.event_type == "user_avatar_uploaded").one()
        self.assertEqual(row.category, "users")
        details = json.loads(row.details)
        self.assertEqual(details["new_avatar_url"], "/uploads/user_avatars/1/avatar.jpg")
