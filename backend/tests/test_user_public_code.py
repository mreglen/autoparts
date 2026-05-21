import re
import unittest

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.models.user import User as UserModel
from app.utils.user_public_code import (
    allocate_public_code,
    assign_public_code,
    is_valid_public_code,
    needs_public_code_migration,
    remigrate_invalid_public_codes,
)


class UserPublicCodeTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    CREATE TABLE users (
                        id INTEGER PRIMARY KEY,
                        public_code VARCHAR(10) UNIQUE,
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
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_valid_format(self):
        self.assertTrue(is_valid_public_code("K482917"))
        self.assertFalse(is_valid_public_code("1000001"))
        self.assertFalse(is_valid_public_code("A123456"))
        self.assertFalse(is_valid_public_code("A111111"))

    def test_needs_migration(self):
        self.assertTrue(needs_public_code_migration(None))
        self.assertTrue(needs_public_code_migration("1000001"))
        self.assertFalse(needs_public_code_migration("B024681"))

    def test_allocate_unique_random(self):
        codes = {allocate_public_code(self.db) for _ in range(20)}
        self.assertEqual(len(codes), 20)
        for c in codes:
            self.assertTrue(is_valid_public_code(c))
            self.assertTrue(re.match(r"^[A-Z][0-9]{6}$", c))

    def test_assign_on_new_user(self):
        u = UserModel(email="new@test.ru")
        assign_public_code(u, self.db)
        self.assertTrue(is_valid_public_code(u.public_code))
        self.db.add(u)
        self.db.commit()

    def test_remigrate_old_codes(self):
        u = UserModel(id=1, public_code="1000001", email="old@test.ru")
        self.db.add(u)
        self.db.commit()
        changes = remigrate_invalid_public_codes(self.db)
        self.assertEqual(len(changes), 1)
        self.db.commit()
        self.db.refresh(u)
        self.assertTrue(is_valid_public_code(u.public_code))
        self.assertNotEqual(u.public_code, "1000001")


if __name__ == "__main__":
    unittest.main()
