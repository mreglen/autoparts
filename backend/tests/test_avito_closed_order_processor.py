import asyncio
import unittest
from unittest.mock import patch

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
import app.models.organization_avito_integration  # noqa: F401
import app.models.organization_drom_integration  # noqa: F401
from app.models.avito_orders_cache import AvitoOrderCache
from app.models.product import Product
from app.models.product_avito_listing_link import ProductAvitoListingLink
from app.models.stock_out import StockOut
from app.services.avito_closed_order_processor import process_closed_avito_order
from app.services.avito_warehouse_fulfillment import (
    FULFILLMENT_FAILED,
    FULFILLMENT_FULFILLED,
    FULFILLMENT_PARTIAL,
)


class AvitoClosedOrderProcessorTests(unittest.TestCase):
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
                    CREATE TABLE product_avito_listing_links (
                        id INTEGER PRIMARY KEY,
                        organization_id VARCHAR(10) NOT NULL,
                        product_id INTEGER NOT NULL,
                        avito_ad_id VARCHAR(64) NOT NULL,
                        avito_id VARCHAR(64),
                        created_at DATETIME,
                        updated_at DATETIME
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE avito_orders_cache (
                        id INTEGER PRIMARY KEY,
                        organization_id VARCHAR(10) NOT NULL,
                        avito_order_id VARCHAR(64) NOT NULL,
                        avito_status_code VARCHAR(50),
                        avito_data JSON,
                        total_amount FLOAT DEFAULT 0,
                        is_paid BOOLEAN DEFAULT 0,
                        created_at DATETIME,
                        updated_at DATETIME,
                        synced_at DATETIME,
                        closed_processed BOOLEAN DEFAULT 0,
                        stock_fulfillment_status VARCHAR(20),
                        last_skip_reasons JSON,
                        last_fulfillment_at DATETIME
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

    def _product(self, *, product_id=1, quantity=5, price=1000, storage_location_id=1):
        product = Product(
            id=product_id,
            internal_code=f"P-{product_id}",
            article=f"A-{product_id}",
            name="Test part",
            brand="Test",
            price=price,
            quantity=quantity,
            organization_id="org1",
            storage_location_id=storage_location_id,
            created_by=1,
            part_type_id=1,
        )
        self.db.add(product)
        self.db.commit()
        return product

    def _link(self, product_id, avito_id="555"):
        link = ProductAvitoListingLink(
            organization_id="org1",
            product_id=product_id,
            avito_ad_id=f"ad-{product_id}",
            avito_id=str(avito_id),
        )
        self.db.add(link)
        self.db.commit()
        return link

    def _order(self, items, **kwargs):
        defaults = {
            "organization_id": "org1",
            "avito_order_id": "777",
            "avito_status_code": "closed",
            "avito_data": {"items": items},
            "total_amount": 1000.0,
            "is_paid": True,
            "closed_processed": False,
        }
        defaults.update(kwargs)
        row = AvitoOrderCache(**defaults)
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def _run(self, coro):
        return asyncio.run(coro)

    @patch("app.services.avito_closed_order_processor._remove_from_avito_xlsx")
    @patch("app.services.avito_closed_order_processor._remove_from_drom_xlsx")
    @patch("app.services.avito_closed_order_processor._delete_listing_links")
    def test_first_process_creates_stock_out(self, _del, _drom, _xlsx):
        product = self._product(quantity=3)
        self._link(product.id, avito_id="555")
        order = self._order(
            [{"avitoId": "555", "count": 1, "prices": {"price": 1000, "total": 1000}}]
        )

        result = self._run(process_closed_avito_order(self.db, order))

        self.assertEqual(result["created_count"], 1)
        self.assertEqual(self.db.query(StockOut).count(), 1)
        self.assertEqual(product.quantity, 2)
        self.assertEqual(order.stock_fulfillment_status, FULFILLMENT_FULFILLED)
        self.assertTrue(order.closed_processed)

    @patch("app.services.avito_closed_order_processor._remove_from_avito_xlsx")
    @patch("app.services.avito_closed_order_processor._remove_from_drom_xlsx")
    @patch("app.services.avito_closed_order_processor._delete_listing_links")
    def test_second_process_is_idempotent(self, _del, _drom, _xlsx):
        product = self._product(quantity=3)
        self._link(product.id, avito_id="555")
        order = self._order(
            [{"avitoId": "555", "count": 1, "prices": {"price": 1000, "total": 1000}}]
        )

        self._run(process_closed_avito_order(self.db, order))
        qty_after_first = product.quantity
        stock_count_after_first = self.db.query(StockOut).count()

        result = self._run(process_closed_avito_order(self.db, order))

        self.assertEqual(result["reused_count"], 1)
        self.assertEqual(result["created_count"], 0)
        self.assertEqual(product.quantity, qty_after_first)
        self.assertEqual(self.db.query(StockOut).count(), stock_count_after_first)

    @patch("app.services.avito_closed_order_processor._remove_from_avito_xlsx")
    @patch("app.services.avito_closed_order_processor._remove_from_drom_xlsx")
    @patch("app.services.avito_closed_order_processor._delete_listing_links")
    def test_retry_after_closed_processed_without_stock_out(self, _del, _drom, _xlsx):
        product = self._product(quantity=2)
        self._link(product.id, avito_id="555")
        order = self._order(
            [{"avitoId": "555", "count": 1, "prices": {"price": 800, "total": 800}}],
            closed_processed=True,
            stock_fulfillment_status=FULFILLMENT_FULFILLED,
        )
        self.assertEqual(self.db.query(StockOut).count(), 0)

        result = self._run(process_closed_avito_order(self.db, order))

        self.assertEqual(result["created_count"], 1)
        self.assertEqual(self.db.query(StockOut).count(), 1)
        self.assertEqual(order.stock_fulfillment_status, FULFILLMENT_FULFILLED)

    def test_listing_not_found_sets_failed(self):
        self._product()
        order = self._order(
            [{"avitoId": "missing", "count": 1, "prices": {"price": 100, "total": 100}}]
        )

        result = self._run(process_closed_avito_order(self.db, order))

        self.assertEqual(self.db.query(StockOut).count(), 0)
        self.assertEqual(order.stock_fulfillment_status, FULFILLMENT_FAILED)
        self.assertEqual(len(result["skipped_reasons"]), 1)
        self.assertEqual(result["skipped_reasons"][0]["code"], "listing_not_found")

    @patch("app.services.avito_closed_order_processor._remove_from_avito_xlsx")
    @patch("app.services.avito_closed_order_processor._remove_from_drom_xlsx")
    @patch("app.services.avito_closed_order_processor._delete_listing_links")
    def test_insufficient_quantity_skips_without_stock_out(self, _del, _drom, _xlsx):
        product = self._product(quantity=0)
        self._link(product.id, avito_id="555")
        order = self._order(
            [{"avitoId": "555", "count": 1, "prices": {"price": 500, "total": 500}}]
        )

        result = self._run(process_closed_avito_order(self.db, order))

        self.assertEqual(self.db.query(StockOut).count(), 0)
        self.assertEqual(result["skipped_reasons"][0]["code"], "insufficient_quantity")
        self.assertEqual(order.stock_fulfillment_status, FULFILLMENT_FAILED)

    @patch("app.services.avito_closed_order_processor._remove_from_avito_xlsx")
    @patch("app.services.avito_closed_order_processor._remove_from_drom_xlsx")
    @patch("app.services.avito_closed_order_processor._delete_listing_links")
    def test_partial_two_items_one_ok(self, _del, _drom, _xlsx):
        p1 = self._product(product_id=1, quantity=5)
        self._link(1, avito_id="111")
        self._product(product_id=2, quantity=5)
        order = self._order(
            [
                {"avitoId": "111", "count": 1, "prices": {"price": 100, "total": 100}},
                {"avitoId": "222", "count": 1, "prices": {"price": 200, "total": 200}},
            ]
        )

        result = self._run(process_closed_avito_order(self.db, order))

        self.assertEqual(result["created_count"], 1)
        self.assertEqual(self.db.query(StockOut).count(), 1)
        self.assertEqual(order.stock_fulfillment_status, FULFILLMENT_PARTIAL)
        self.assertFalse(order.closed_processed)
        self.assertEqual(p1.quantity, 4)

    def test_zero_price_skipped(self):
        product = self._product(price=0)
        self._link(product.id, avito_id="555")
        order = self._order(
            [{"avitoId": "555", "count": 1, "prices": {"price": 0, "total": 0}}]
        )

        result = self._run(process_closed_avito_order(self.db, order))

        self.assertEqual(self.db.query(StockOut).count(), 0)
        self.assertEqual(result["skipped_reasons"][0]["code"], "zero_price")
