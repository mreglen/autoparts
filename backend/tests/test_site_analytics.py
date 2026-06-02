import unittest

import app.models  # noqa: F401
import app.models.organization_avito_integration  # noqa: F401
import app.models.organization_drom_integration  # noqa: F401
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.models.site_analytics import (
    SiteAnalyticsFormEvent,
    SiteAnalyticsPageView,
    SiteAnalyticsSession,
)
from app.schemas.site_analytics import AnalyticsEventIn
from app.services.site_analytics_service import (
    extract_product_id_from_path,
    get_forms,
    get_page_detail,
    get_pages,
    get_popular_new_part_queries,
    get_product_cards,
    get_summary,
    ingest_events,
    normalize_path,
)


class SiteAnalyticsServiceTests(unittest.TestCase):
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
                    CREATE TABLE site_analytics_sessions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        visitor_id VARCHAR(64) NOT NULL,
                        user_id INTEGER,
                        started_at DATETIME,
                        last_seen_at DATETIME,
                        duration_sec INTEGER NOT NULL DEFAULT 0,
                        page_views_count INTEGER NOT NULL DEFAULT 0
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE site_analytics_page_views (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        session_id INTEGER NOT NULL,
                        client_view_id VARCHAR(64),
                        path_template VARCHAR(512) NOT NULL,
                        path_raw VARCHAR(2048) NOT NULL,
                        entered_at DATETIME,
                        duration_sec INTEGER NOT NULL DEFAULT 0
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE site_analytics_form_events (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        session_id INTEGER NOT NULL,
                        form_id VARCHAR(64) NOT NULL,
                        field_name VARCHAR(128),
                        event_type VARCHAR(32) NOT NULL,
                        created_at DATETIME
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
                        internal_code VARCHAR(100) NOT NULL,
                        is_new BOOLEAN,
                        quantity INTEGER,
                        organization_id VARCHAR,
                        created_by INTEGER NOT NULL,
                        part_type_id INTEGER NOT NULL
                    )
                    """
                )
            )

    def test_normalize_path_product_detail(self):
        template, raw = normalize_path("/part/123-brand-article")
        self.assertEqual(template, "/part/:productId")
        self.assertEqual(raw, "/part/123-brand-article")

    def test_normalize_path_static(self):
        template, raw = normalize_path("/catalog")
        self.assertEqual(template, "/catalog")
        self.assertEqual(raw, "/catalog")

    def test_ingest_page_view_and_heartbeat_updates_duration(self):
        visitor_id = "visitor-test-001"
        view_id = "view-test-001"
        ingest_events(
            self.db,
            [
                AnalyticsEventIn(
                    type="page_view",
                    visitor_id=visitor_id,
                    path="/catalog",
                    view_id=view_id,
                ),
                AnalyticsEventIn(
                    type="heartbeat",
                    visitor_id=visitor_id,
                    view_id=view_id,
                    duration_sec=45,
                ),
            ],
            user_id=None,
        )

        session = self.db.query(SiteAnalyticsSession).filter_by(visitor_id=visitor_id).one()
        self.assertEqual(session.page_views_count, 1)
        self.assertEqual(session.duration_sec, 45)

        page_view = self.db.query(SiteAnalyticsPageView).filter_by(session_id=session.id).one()
        self.assertEqual(page_view.path_template, "/catalog")
        self.assertEqual(page_view.duration_sec, 45)

    def test_form_events_store_field_names_only(self):
        visitor_id = "visitor-test-002"
        ingest_events(
            self.db,
            [
                AnalyticsEventIn(
                    type="page_view",
                    visitor_id=visitor_id,
                    path="/auth",
                    view_id="view-auth",
                ),
                AnalyticsEventIn(
                    type="form_field",
                    visitor_id=visitor_id,
                    form_id="auth_login",
                    field_name="login",
                ),
                AnalyticsEventIn(
                    type="form_field",
                    visitor_id=visitor_id,
                    form_id="auth_login",
                    field_name="password",
                ),
                AnalyticsEventIn(
                    type="form_submit",
                    visitor_id=visitor_id,
                    form_id="auth_login",
                    filled_fields=["login", "password"],
                ),
            ],
            user_id=None,
        )

        events = self.db.query(SiteAnalyticsFormEvent).order_by(SiteAnalyticsFormEvent.id).all()
        field_names = [event.field_name for event in events if event.field_name]
        self.assertIn("login", field_names)
        self.assertNotIn("password", field_names)

        forms = get_forms(self.db, days=7)
        login_rows = [row for row in forms.items if row.form_id == "auth_login"]
        self.assertTrue(any(row.field_name == "login" for row in login_rows))

    def test_extract_product_id_from_path(self):
        self.assertEqual(extract_product_id_from_path("/part/42-brand-article"), 42)
        self.assertEqual(extract_product_id_from_path("/part/7"), 7)
        self.assertIsNone(extract_product_id_from_path("/catalog"))

    def test_page_detail_and_product_cards(self):
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO products (id, article, name, brand, internal_code, is_new, quantity, created_by, part_type_id)
                    VALUES (10, 'ART1', 'Фильтр масляный', 'MANN', 'TEST-10', 0, 1, 1, 1)
                    """
                )
            )

        path_a = "/part/10-mann-art1"
        path_b = "/part/10-mann-art1-copy"
        visitor = "visitor-cards"
        ingest_events(
            self.db,
            [
                AnalyticsEventIn(type="page_view", visitor_id=visitor, path=path_a, view_id="v1"),
                AnalyticsEventIn(type="page_view", visitor_id=visitor, path=path_b, view_id="v2"),
                AnalyticsEventIn(type="page_view", visitor_id="visitor-other", path="/catalog", view_id="v3"),
            ],
            user_id=None,
        )

        detail = get_page_detail(self.db, "/part/:productId", days=7)
        self.assertEqual(detail.page_views, 2)
        self.assertEqual(detail.path_template, "/part/:productId")
        self.assertGreaterEqual(len(detail.instances), 1)

        cards = get_product_cards(self.db, days=7, limit=10)
        self.assertEqual(cards.total_views, 2)
        self.assertGreaterEqual(cards.unique_cards, 1)
        top = cards.items[0]
        self.assertEqual(top.product_id, 10)
        self.assertEqual(top.brand, "MANN")
        self.assertEqual(top.article, "ART1")

        catalog_detail = get_page_detail(self.db, "/catalog", days=7)
        self.assertEqual(catalog_detail.page_views, 1)
        self.assertEqual(len(catalog_detail.activity), 1)

    def test_summary_and_pages_aggregation(self):
        visitor_a = "visitor-a"
        visitor_b = "visitor-b"
        ingest_events(
            self.db,
            [
                AnalyticsEventIn(type="page_view", visitor_id=visitor_a, path="/catalog", view_id="v1"),
                AnalyticsEventIn(type="page_view", visitor_id=visitor_b, path="/catalog", view_id="v2"),
                AnalyticsEventIn(
                    type="page_view",
                    visitor_id=visitor_a,
                    path="/part/10-brand-art",
                    view_id="v3",
                ),
                AnalyticsEventIn(type="heartbeat", visitor_id=visitor_a, view_id="v1", duration_sec=30),
            ],
            user_id=None,
        )

        summary = get_summary(self.db, days=7)
        self.assertEqual(summary.page_views, 3)
        self.assertEqual(summary.unique_visitors, 2)

        pages = get_pages(self.db, days=7)
        catalog_row = next(row for row in pages.items if row.path_template == "/catalog")
        self.assertEqual(catalog_row.views, 2)
        part_row = next(row for row in pages.items if row.path_template == "/part/:productId")
        self.assertEqual(part_row.views, 1)

    def test_popular_new_part_queries_aggregates_and_filters_noise(self):
        ingest_events(
            self.db,
            [
                AnalyticsEventIn(
                    type="page_view",
                    visitor_id="v-a",
                    path="/autoparts/new?q=KRAFT%20KT%20100529",
                    view_id="q1",
                ),
                AnalyticsEventIn(
                    type="page_view",
                    visitor_id="v-b",
                    path="/autoparts/new?q=KRAFT%20KT%20100529",
                    view_id="q2",
                ),
                AnalyticsEventIn(
                    type="page_view",
                    visitor_id="v-c",
                    path="/autoparts/new?q=масляный%20фильтр",
                    view_id="q3",
                ),
                AnalyticsEventIn(
                    type="page_view",
                    visitor_id="v-d",
                    path="/autoparts/new?q=запчасти",
                    view_id="q4",
                ),
            ],
            user_id=None,
        )

        items, generated_at = get_popular_new_part_queries(self.db, limit=8, days=30)
        self.assertGreaterEqual(len(items), 2)
        self.assertEqual(items[0], "KRAFT KT 100529")
        self.assertIn("масляный фильтр", items)
        self.assertNotIn("запчасти", [item.lower() for item in items])
        self.assertIsNotNone(generated_at)


class SiteAnalyticsAdminAccessTests(unittest.TestCase):
    def test_admin_dependency_requires_is_admin(self):
        from app.core.auth import get_current_admin_user
        from fastapi import HTTPException

        class FakeUser:
            def __init__(self, user_id, is_admin):
                self.id = user_id
                self.is_admin = is_admin

        admin = FakeUser(1, True)
        regular = FakeUser(2, False)

        self.assertEqual(get_current_admin_user(current_user=admin).id, 1)
        with self.assertRaises(HTTPException) as ctx:
            get_current_admin_user(current_user=regular)
        self.assertEqual(ctx.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
