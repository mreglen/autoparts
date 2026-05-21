import unittest
from datetime import datetime, timezone

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.models.avito_orders_cache import AvitoOrderCache
from app.models.stock_out import StockOut
from app.services.avito_warehouse_fulfillment import (
    FULFILLMENT_FAILED,
    FULFILLMENT_FULFILLED,
    FULFILLMENT_PARTIAL,
    compute_warehouse_fulfillment,
    count_expected_items,
    derive_fulfillment_status,
    update_fulfillment_fields,
)


class AvitoWarehouseFulfillmentTests(unittest.TestCase):
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

    def _order(self, **kwargs):
        defaults = {
            "organization_id": "org1",
            "avito_order_id": "9001",
            "avito_status_code": "closed",
            "avito_data": {
                "items": [
                    {"avitoId": "111", "count": 1, "prices": {"price": 500, "total": 500}},
                ]
            },
            "total_amount": 500.0,
            "is_paid": True,
        }
        defaults.update(kwargs)
        row = AvitoOrderCache(**defaults)
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def test_count_expected_items(self):
        order = self._order()
        self.assertEqual(count_expected_items(order), 1)

    def test_derive_fulfilled_when_stock_outs_match(self):
        status = derive_fulfillment_status(
            is_closed=True,
            expected_item_count=2,
            stock_out_count=2,
        )
        self.assertEqual(status, FULFILLMENT_FULFILLED)

    def test_compute_mismatch_when_closed_without_stock_out(self):
        order = self._order()
        wf = compute_warehouse_fulfillment(self.db, order)
        self.assertTrue(wf["mismatch"])
        self.assertTrue(wf["can_retry"])
        self.assertEqual(wf["expected_item_count"], 1)
        self.assertEqual(wf["stock_out_count"], 0)

    def test_compute_fulfilled_with_stock_out(self):
        order = self._order()
        self.db.add(
            StockOut(
                organization_id="org1",
                product_id=1,
                quantity=1,
                sale_price=500,
                avito_order_id="9001",
                source_kind="avito",
            )
        )
        self.db.commit()
        wf = compute_warehouse_fulfillment(self.db, order)
        self.assertEqual(wf["status"], FULFILLMENT_FULFILLED)
        self.assertFalse(wf["mismatch"])
        self.assertFalse(wf["can_retry"])

    def test_update_fulfillment_fields_partial(self):
        order = self._order()
        update_fulfillment_fields(
            order,
            {
                "skipped_reasons": [{"code": "listing_not_found"}],
            },
            db=self.db,
        )
        self.assertEqual(order.stock_fulfillment_status, FULFILLMENT_FAILED)
        self.assertFalse(order.closed_processed)

    def test_update_fulfillment_fields_fulfilled(self):
        order = self._order()
        self.db.add(
            StockOut(
                organization_id="org1",
                product_id=10,
                quantity=1,
                sale_price=500,
                avito_order_id="9001",
                source_kind="avito",
            )
        )
        self.db.commit()
        update_fulfillment_fields(order, {"skipped_reasons": []}, db=self.db)
        self.assertEqual(order.stock_fulfillment_status, FULFILLMENT_FULFILLED)
        self.assertTrue(order.closed_processed)

    def test_partial_status(self):
        order = self._order(
            avito_data={
                "items": [
                    {"avitoId": "1", "count": 1, "prices": {"total": 100}},
                    {"avitoId": "2", "count": 1, "prices": {"total": 200}},
                ]
            }
        )
        self.db.add(
            StockOut(
                organization_id="org1",
                product_id=1,
                quantity=1,
                sale_price=100,
                avito_order_id="9001",
                source_kind="avito",
            )
        )
        self.db.commit()
        wf = compute_warehouse_fulfillment(self.db, order)
        self.assertEqual(wf["status"], FULFILLMENT_PARTIAL)
        self.assertTrue(wf["mismatch"])
