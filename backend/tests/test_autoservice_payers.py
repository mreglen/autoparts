import sys
import types
import unittest

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError


class AutoservicePayersTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    CREATE TABLE autoservice_payers (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        organization_id VARCHAR(10) NOT NULL,
                        name VARCHAR(255) NOT NULL,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE (organization_id, name)
                    )
                    """
                )
            )

    def test_unique_name_per_organization(self):
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO autoservice_payers (organization_id, name) VALUES ('ORG1', 'Иванов')"
                )
            )
            with self.assertRaises(IntegrityError):
                conn.execute(
                    text(
                        "INSERT INTO autoservice_payers (organization_id, name) VALUES ('ORG1', 'Иванов')"
                    )
                )

    def test_same_name_allowed_in_other_organization(self):
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO autoservice_payers (organization_id, name) VALUES ('ORG1', 'Иванов')"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO autoservice_payers (organization_id, name) VALUES ('ORG2', 'Иванов')"
                )
            )
            count = conn.execute(text("SELECT COUNT(*) FROM autoservice_payers")).scalar()
        self.assertEqual(count, 2)

    def test_delete_nulls_payer_id_keeps_snapshot(self):
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    CREATE TABLE autoservice_payments (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        payer_id INTEGER,
                        payer_name VARCHAR(255)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    "INSERT INTO autoservice_payers (organization_id, name) VALUES ('ORG1', 'ООО Ромашка')"
                )
            )
            payer_id = conn.execute(text("SELECT id FROM autoservice_payers")).scalar()
            conn.execute(
                text(
                    "INSERT INTO autoservice_payments (payer_id, payer_name) VALUES (:pid, 'ООО Ромашка')"
                ),
                {"pid": payer_id},
            )
            conn.execute(
                text("UPDATE autoservice_payments SET payer_id = NULL WHERE payer_id = :pid"),
                {"pid": payer_id},
            )
            conn.execute(text("DELETE FROM autoservice_payers WHERE id = :pid"), {"pid": payer_id})
            row = conn.execute(text("SELECT payer_id, payer_name FROM autoservice_payments")).one()
        self.assertIsNone(row[0])
        self.assertEqual(row[1], "ООО Ромашка")


if __name__ == "__main__":
    unittest.main()
