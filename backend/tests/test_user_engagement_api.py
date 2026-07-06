import unittest
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
import app.models.organization_avito_integration  # noqa: F401
import app.models.organization_drom_integration  # noqa: F401

from app.models.product import Product as ProductModel
from app.models.user import User as UserModel
from app.models.user_engagement import UserFavorite, UserProductView
from app.services import user_engagement_service as engagement
from app.services import search_subscription_service as subscriptions


class UserEngagementServiceTests(unittest.TestCase):
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
                        avatar_url VARCHAR(512),
                        notify_push_enabled BOOLEAN DEFAULT 1,
                        notify_email_enabled BOOLEAN DEFAULT 1,
                        organization_id VARCHAR(10)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE products (
                        id INTEGER PRIMARY KEY,
                        article VARCHAR(30),
                        name VARCHAR(255),
                        brand VARCHAR(100),
                        internal_code VARCHAR(100) NOT NULL UNIQUE,
                        description TEXT,
                        is_new BOOLEAN DEFAULT 0,
                        price NUMERIC(12, 2),
                        quantity INTEGER,
                        organization_id VARCHAR(10),
                        storage_location_id INTEGER,
                        created_by INTEGER NOT NULL,
                        part_type_id INTEGER NOT NULL DEFAULT 1
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE organizations (
                        id VARCHAR(10) PRIMARY KEY,
                        name VARCHAR(255),
                        address VARCHAR(255),
                        phone VARCHAR(50),
                        logo_organization VARCHAR(255),
                        description TEXT,
                        watermark VARCHAR(255),
                        new_parts_markup_percent FLOAT,
                        new_parts_markup_manual BOOLEAN
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE product_photos (
                        id INTEGER PRIMARY KEY,
                        product_id INTEGER,
                        photo_url TEXT,
                        thumb_url TEXT,
                        organization_id VARCHAR(10),
                        processing_status VARCHAR(20)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE user_favorites (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        product_id INTEGER NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(user_id, product_id)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE user_product_views (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        product_id INTEGER NOT NULL,
                        viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(user_id, product_id)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE search_subscriptions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        query_text TEXT NOT NULL,
                        query_normalized VARCHAR(512) NOT NULL,
                        is_active BOOLEAN NOT NULL DEFAULT 1,
                        unsubscribe_token VARCHAR(64) NOT NULL UNIQUE,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        last_notified_at DATETIME,
                        UNIQUE(user_id, query_normalized)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE search_subscription_notifications (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        subscription_id INTEGER NOT NULL,
                        product_id INTEGER NOT NULL,
                        notified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(subscription_id, product_id)
                    )
                    """
                )
            )

    def _seed(self):
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO users (id, public_code, email) VALUES (1, 'U10000001', 'buyer@test.ru')"
                )
            )
            for idx in range(1, 55):
                conn.execute(
                    text(
                        """
                        INSERT INTO products (
                            id, article, name, brand, internal_code, is_new, price, quantity,
                            organization_id, created_by, part_type_id
                        ) VALUES (
                            :id, :article, :name, 'TEST', :code, 0, :price, 1, 'ORG1', 1, 1
                        )
                        """
                    ),
                    {
                        "id": idx,
                        "article": f"A{idx}",
                        "name": f"Part {idx}",
                        "code": f"INT-{idx}",
                        "price": 100 + idx,
                    },
                )
            conn.execute(
                text(
                    "INSERT INTO organizations (id, name, phone) VALUES ('ORG1', 'Test Org', '+79990000000')"
                )
            )

    @patch(
        "app.utils.product_list_item.display_product_price",
        side_effect=lambda price, db=None: float(price or 0),
    )
    def test_favorites_add_remove_list_status(self, _price):
        self.assertFalse(engagement.is_favorite(self.db, 1, 1))
        engagement.add_favorite(self.db, 1, 1)
        self.assertTrue(engagement.is_favorite(self.db, 1, 1))
        items = engagement.list_favorites(self.db, 1)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].id, 1)
        engagement.remove_favorite(self.db, 1, 1)
        self.assertFalse(engagement.is_favorite(self.db, 1, 1))

    def test_favorite_unknown_product_404(self):
        with self.assertRaises(HTTPException) as ctx:
            engagement.add_favorite(self.db, 1, 9999)
        self.assertEqual(ctx.exception.status_code, 404)

    @patch(
        "app.utils.product_list_item.display_product_price",
        side_effect=lambda price, db=None: float(price or 0),
    )
    def test_favorite_new_product_allowed(self, _price):
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO products (
                        id, article, name, brand, internal_code, is_new, price, quantity,
                        organization_id, created_by, part_type_id
                    ) VALUES (
                        100, 'N100', 'New part', 'TEST', 'INT-100', 1, 500, 1, 'ORG1', 1, 1
                    )
                    """
                )
            )
        engagement.add_favorite(self.db, 1, 100)
        self.assertTrue(engagement.is_favorite(self.db, 1, 100))
        items = engagement.list_favorites(self.db, 1)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].id, 100)
        engagement.record_product_view(self.db, 1, 100)
        history = engagement.list_view_history(self.db, 1)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0].id, 100)

    @patch(
        "app.utils.product_list_item.display_product_price",
        side_effect=lambda price, db=None: float(price or 0),
    )
    def test_view_history_upsert_and_trim(self, _price):
        for product_id in range(1, 55):
            engagement.record_product_view(self.db, 1, product_id)

        history = engagement.list_view_history(self.db, 1)
        self.assertEqual(len(history), 50)
        view_rows = self.db.query(UserProductView).filter(UserProductView.user_id == 1).count()
        self.assertEqual(view_rows, 50)

        engagement.clear_view_history(self.db, 1)
        self.assertEqual(engagement.list_view_history(self.db, 1), [])

    def test_search_subscription_crud(self):
        row = subscriptions.create_search_subscription(self.db, 1, "TEST A1")
        self.assertEqual(row.query_text, "TEST A1")
        rows = subscriptions.list_search_subscriptions(self.db, 1)
        self.assertEqual(len(rows), 1)
        subscriptions.delete_search_subscription(self.db, 1, row.id)
        self.assertEqual(subscriptions.list_search_subscriptions(self.db, 1), [])

    def test_favorite_row_count(self):
        engagement.add_favorite(self.db, 1, 2)
        engagement.add_favorite(self.db, 1, 3)
        count = self.db.query(UserFavorite).filter(UserFavorite.user_id == 1).count()
        self.assertEqual(count, 2)


if __name__ == "__main__":
    unittest.main()
