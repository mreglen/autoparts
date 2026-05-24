import unittest

import app.models  # noqa: F401
import app.models.organization_avito_integration  # noqa: F401
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.models.site_review import SiteReview
from app.services.site_reviews_service import (
    DEFAULT_REVIEWS,
    create_site_review,
    ensure_default_site_reviews,
    list_site_reviews,
    reviews_summary,
)
from app.schemas.site_review import SiteReviewCreateIn


class SiteReviewsServiceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        self._create_tables()
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _create_tables(self):
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    CREATE TABLE site_reviews (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER,
                        author_name VARCHAR(120) NOT NULL,
                        author_role VARCHAR(80),
                        text TEXT NOT NULL,
                        rating INTEGER NOT NULL DEFAULT 5,
                        source VARCHAR(32) NOT NULL DEFAULT 'platform',
                        review_date DATETIME,
                        featured INTEGER NOT NULL DEFAULT 0,
                        enabled INTEGER NOT NULL DEFAULT 1,
                        sort_order INTEGER NOT NULL DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
            )

    def test_seed_default_reviews_once(self):
        ensure_default_site_reviews(self.db)
        first_count = self.db.query(SiteReview).count()
        ensure_default_site_reviews(self.db)
        second_count = self.db.query(SiteReview).count()
        self.assertEqual(first_count, len(DEFAULT_REVIEWS))
        self.assertEqual(second_count, len(DEFAULT_REVIEWS))

    def test_featured_filter_and_summary(self):
        ensure_default_site_reviews(self.db)
        featured = list_site_reviews(self.db, featured_only=True, limit=3)
        all_reviews = list_site_reviews(self.db)
        avg, count = reviews_summary(self.db, all_reviews)

        self.assertEqual(len(featured), 3)
        self.assertTrue(all(item.featured for item in featured))
        self.assertEqual(count, len(DEFAULT_REVIEWS))
        self.assertGreaterEqual(avg, 4.0)

    def test_create_guest_review(self):
        row = create_site_review(
            self.db,
            SiteReviewCreateIn(
                text="Отличный магазин, всё быстро и понятно.",
                rating=5,
                author_name="Петров Пётр Петрович",
            ),
        )
        self.assertEqual(row.author_name, "Петров Пётр Петрович")
        self.assertIsNone(row.user_id)
        self.assertEqual(row.source, "platform")
        self.assertTrue(row.enabled)

    def test_create_authenticated_review_ignores_guest_name(self):
        from types import SimpleNamespace

        user = SimpleNamespace(
            id=42,
            last_name="Сидоров",
            first_name="Сергей",
            patronymic="Иванович",
            email="test@example.com",
            is_buyer=True,
            is_seller=False,
        )

        row = create_site_review(
            self.db,
            SiteReviewCreateIn(
                text="Покупал запчасти — всё супер, рекомендую.",
                rating=4,
                author_name="Чужое имя",
            ),
            user=user,
        )
        self.assertEqual(row.user_id, 42)
        self.assertEqual(row.author_name, "Сидоров Сергей Иванович")
        self.assertEqual(row.author_role, "Покупатель")


if __name__ == "__main__":
    unittest.main()
