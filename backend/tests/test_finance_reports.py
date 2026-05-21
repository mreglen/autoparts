import unittest
from datetime import date

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
import app.models.organization_avito_integration  # noqa: F401
import app.models.organization_drom_integration  # noqa: F401
from app.models.product import Product
from app.models.stock_in import StockIn
from app.models.stock_out import StockOut
from app.services.finance_reports import (
    CHANNEL_AVITO,
    CHANNEL_WAREHOUSE,
    FinanceFilters,
    list_finance_inventory,
    list_finance_sales,
    list_finance_stock_ins,
    list_finance_writeoffs,
)


class FinanceReportsTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        self._create_tables()
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.db = self.Session()
        self.org_id = "org1"
        self._seed()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _create_tables(self):
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    CREATE TABLE products (
                        id INTEGER PRIMARY KEY,
                        article VARCHAR(30),
                        name VARCHAR(255),
                        brand VARCHAR(100),
                        internal_code VARCHAR(100) NOT NULL,
                        description TEXT,
                        is_new BOOLEAN,
                        price NUMERIC(12, 2),
                        quantity INTEGER,
                        organization_id VARCHAR,
                        storage_location_id INTEGER,
                        created_by INTEGER NOT NULL,
                        part_type_id INTEGER NOT NULL
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE stock_out (
                        id INTEGER PRIMARY KEY,
                        quantity INTEGER,
                        sale_price NUMERIC(12, 2),
                        movement_date DATE,
                        organization_id VARCHAR,
                        storage_location_id INTEGER,
                        product_id INTEGER,
                        acquired_product_id INTEGER,
                        user_id INTEGER,
                        reason TEXT,
                        sale_channel VARCHAR(50),
                        avito_order_id VARCHAR(64),
                        source_kind VARCHAR(32),
                        garage_used_order_item_id INTEGER
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE stock_in (
                        id INTEGER PRIMARY KEY,
                        quantity INTEGER,
                        sale_price NUMERIC(12, 2),
                        created_at DATE,
                        organization_id VARCHAR,
                        storage_location_id INTEGER,
                        product_id INTEGER,
                        acquired_product_id INTEGER,
                        created_by INTEGER NOT NULL
                    )
                    """
                )
            )

    def _seed(self):
        p1 = Product(
            id=1,
            internal_code="P-1",
            article="A-1",
            name="Part One",
            brand="B",
            price=100,
            quantity=10,
            organization_id=self.org_id,
            storage_location_id=1,
            created_by=1,
            part_type_id=1,
        )
        p2 = Product(
            id=2,
            internal_code="P-2",
            article="A-2",
            name="Part Two",
            brand="B",
            price=200,
            quantity=5,
            organization_id=self.org_id,
            storage_location_id=1,
            created_by=1,
            part_type_id=1,
        )
        self.db.add_all([p1, p2])
        self.db.add(
            StockOut(
                organization_id=self.org_id,
                product_id=1,
                quantity=1,
                sale_price=500,
                movement_date=date(2026, 3, 10),
                storage_location_id=1,
                sale_channel="avito",
                source_kind="avito",
                avito_order_id="9001",
            )
        )
        self.db.add(
            StockOut(
                organization_id=self.org_id,
                product_id=2,
                quantity=2,
                sale_price=300,
                movement_date=date(2026, 3, 15),
                storage_location_id=1,
                source_kind="warehouse_manual",
                sale_channel="warehouse",
            )
        )
        self.db.add(
            StockOut(
                organization_id=self.org_id,
                product_id=1,
                quantity=1,
                sale_price=0,
                movement_date=date(2026, 3, 12),
                storage_location_id=1,
                source_kind="writeoff",
                reason="Брак",
            )
        )
        self.db.add(
            StockOut(
                organization_id=self.org_id,
                product_id=2,
                quantity=1,
                sale_price=1000,
                movement_date=date(2026, 4, 1),
                storage_location_id=1,
                source_kind="avito",
                avito_order_id="9002",
            )
        )
        self.db.add(
            StockIn(
                organization_id=self.org_id,
                product_id=1,
                quantity=5,
                sale_price=80,
                created_at=date(2026, 3, 5),
                storage_location_id=1,
                created_by=1,
            )
        )
        self.db.commit()

    def test_sales_filtered_by_date(self):
        filters = FinanceFilters(
            date_from=date(2026, 3, 1),
            date_to=date(2026, 3, 31),
            as_of_date=date(2026, 3, 31),
        )
        rows, totals = list_finance_sales(self.db, self.org_id, filters)
        self.assertEqual(len(rows), 2)
        self.assertEqual(totals["count"], 2)
        dates = {r["movement_date"] for r in rows}
        self.assertIn(date(2026, 3, 10), dates)
        self.assertIn(date(2026, 3, 15), dates)
        self.assertNotIn(date(2026, 4, 1), dates)

    def test_sales_totals_match_row_sum(self):
        filters = FinanceFilters(
            date_from=date(2026, 3, 1),
            date_to=date(2026, 3, 31),
            as_of_date=date(2026, 3, 31),
        )
        rows, totals = list_finance_sales(self.db, self.org_id, filters)
        row_sum = sum(r["line_total"] for r in rows)
        self.assertEqual(totals["count"], len(rows))
        self.assertAlmostEqual(totals["total"], row_sum, places=2)
        self.assertAlmostEqual(totals["total"], 500 + 600, places=2)

    def test_writeoff_not_in_sales(self):
        filters = FinanceFilters(
            date_from=date(2026, 3, 1),
            date_to=date(2026, 3, 31),
            as_of_date=date(2026, 3, 31),
        )
        writeoff_rows, _ = list_finance_writeoffs(self.db, self.org_id, filters)
        self.assertEqual(len(writeoff_rows), 1)
        self.assertEqual(writeoff_rows[0]["reason"], "Брак")

    def test_channel_filter_avito(self):
        filters = FinanceFilters(
            date_from=date(2026, 3, 1),
            date_to=date(2026, 3, 31),
            as_of_date=date(2026, 3, 31),
            channel=CHANNEL_AVITO,
        )
        rows, totals = list_finance_sales(self.db, self.org_id, filters)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["channel"], CHANNEL_AVITO)
        self.assertEqual(totals["count"], 1)

    def test_stock_ins_in_period(self):
        filters = FinanceFilters(
            date_from=date(2026, 3, 1),
            date_to=date(2026, 3, 31),
            as_of_date=date(2026, 3, 31),
        )
        rows, totals = list_finance_stock_ins(self.db, self.org_id, filters)
        self.assertEqual(len(rows), 1)
        self.assertEqual(totals["total_qty"], 5)

    def test_inventory_as_of(self):
        filters = FinanceFilters(
            date_from=date(2026, 3, 31),
            date_to=date(2026, 3, 31),
            as_of_date=date(2026, 3, 31),
        )
        rows, totals = list_finance_inventory(self.db, self.org_id, filters)
        by_product = {r["product_id"]: r["quantity"] for r in rows}
        self.assertEqual(by_product.get(1), 5 - 1 - 1)
        self.assertEqual(by_product.get(2), 0 - 2)
