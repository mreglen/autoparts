import unittest

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.models.user import User as UserModel
from app.utils.user_public_code import PUBLIC_CODE_START, allocate_public_code, assign_public_code


class UserPublicCodeTests(unittest.TestCase):
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
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_allocate_first_code(self):
        self.assertEqual(allocate_public_code(self.db), str(PUBLIC_CODE_START))

    def test_allocate_sequential(self):
        u1 = UserModel(id=1, public_code="1000001", email="a@test.ru")
        u2 = UserModel(id=2, public_code="1000002", email="b@test.ru")
        self.db.add_all([u1, u2])
        self.db.commit()
        self.assertEqual(allocate_public_code(self.db), "1000003")

    def test_assign_on_new_user(self):
        u = UserModel(email="new@test.ru")
        assign_public_code(u, self.db)
        self.assertEqual(u.public_code, str(PUBLIC_CODE_START))
        self.db.add(u)
        self.db.commit()
        self.assertIsNotNone(u.id)


if __name__ == "__main__":
    unittest.main()
