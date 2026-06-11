import unittest

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.services.used_catalog_service import (
    count_used_products_by_brand,
    count_used_products_by_city,
    find_used_brand_name_by_slug,
)


class UsedCatalogServiceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    CREATE TABLE organizations (
                        id VARCHAR(10) PRIMARY KEY,
                        address TEXT
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE products (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        brand VARCHAR(120),
                        quantity INTEGER DEFAULT 0,
                        is_new INTEGER NOT NULL DEFAULT 0,
                        organization_id VARCHAR(10)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    "INSERT INTO organizations (id, address) VALUES "
                    "('org1', 'г. Екатеринбург, ул. Test'), ('org2', 'г. Москва, ул. Other')"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO products (brand, quantity, is_new, organization_id) VALUES "
                    "('BOSCH', 2, 0, 'org1'), ('BOSCH', 1, 0, 'org2'), ('NGK', 1, 0, 'org1'), ('BOSCH', 5, 1, 'org1')"
                )
            )
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_find_used_brand_name_by_slug(self):
        self.assertEqual(find_used_brand_name_by_slug(self.db, "bosch"), "BOSCH")
        self.assertIsNone(find_used_brand_name_by_slug(self.db, "missing"))

    def test_count_used_products_by_brand(self):
        self.assertEqual(count_used_products_by_brand(self.db, "BOSCH"), 2)

    def test_count_used_products_by_city(self):
        self.assertEqual(count_used_products_by_city(self.db, "Екатеринбург"), 2)
        self.assertEqual(count_used_products_by_city(self.db, "Москва"), 1)


if __name__ == "__main__":
    unittest.main()
