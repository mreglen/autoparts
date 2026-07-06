import unittest
from unittest.mock import patch

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
import app.models.organization_avito_integration  # noqa: F401
import app.models.organization_drom_integration  # noqa: F401

from app.models.product import Product as ProductModel
from app.models.user import User as UserModel
from app.models.user_engagement import SearchSubscription, SearchSubscriptionNotification
from app.services.search_subscription_service import (
    create_search_subscription,
    deactivate_subscription_by_token,
    normalize_subscription_query,
    notify_subscribers_for_product,
    product_matches_subscription_query,
)


class SearchSubscriptionServiceTests(unittest.TestCase):
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
                    CREATE TABLE search_subscriptions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        query_text TEXT NOT NULL,
                        query_normalized VARCHAR(512) NOT NULL,
                        is_active BOOLEAN NOT NULL DEFAULT 1,
                        unsubscribe_token VARCHAR(64) NOT NULL UNIQUE,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        last_notified_at DATETIME
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
            conn.execute(
                text(
                    """
                    INSERT INTO products (
                        id, article, name, brand, internal_code, is_new, price, quantity,
                        organization_id, created_by, part_type_id
                    ) VALUES (
                        10, '0 451 103 073', 'Фильтр масляный', 'BOSCH', 'INT-BOSCH-073',
                        0, 1500, 2, 'ORG1', 1, 1
                    )
                    """
                )
            )

    def test_normalize_subscription_query(self):
        self.assertEqual(normalize_subscription_query("  BOSCH  073  "), "bosch 073")

    def test_product_matches_brand_article(self):
        product = self.db.query(ProductModel).get(10)
        self.assertTrue(
            product_matches_subscription_query(self.db, product, "BOSCH 0 451 103 073")
        )

    def test_product_matches_article_only(self):
        product = self.db.query(ProductModel).get(10)
        self.assertTrue(product_matches_subscription_query(self.db, product, "0451103073"))

    def test_product_does_not_match_unrelated_query(self):
        product = self.db.query(ProductModel).get(10)
        self.assertFalse(product_matches_subscription_query(self.db, product, "MANN W712"))

    def test_create_subscription_dedup_normalized(self):
        first = create_search_subscription(self.db, 1, "BOSCH 073")
        second = create_search_subscription(self.db, 1, "  bosch   073 ")
        self.assertEqual(first.id, second.id)
        count = self.db.query(SearchSubscription).count()
        self.assertEqual(count, 1)

    def test_deactivate_subscription_by_token(self):
        row = create_search_subscription(self.db, 1, "BOSCH 073")
        self.assertTrue(deactivate_subscription_by_token(self.db, row.unsubscribe_token))
        self.db.refresh(row)
        self.assertFalse(row.is_active)
        self.assertFalse(deactivate_subscription_by_token(self.db, "missing-token"))

    @patch("app.services.search_subscription_service.dispatch_user_notification")
    def test_notify_subscribers_sends_once(self, mock_dispatch):
        create_search_subscription(self.db, 1, "BOSCH 0 451 103 073")
        count_first = notify_subscribers_for_product(self.db, 10)
        count_second = notify_subscribers_for_product(self.db, 10)

        self.assertEqual(count_first, 1)
        self.assertEqual(count_second, 0)
        self.assertEqual(mock_dispatch.call_count, 1)
        log_count = self.db.query(SearchSubscriptionNotification).count()
        self.assertEqual(log_count, 1)


if __name__ == "__main__":
    unittest.main()
