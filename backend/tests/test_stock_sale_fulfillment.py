import unittest
from datetime import date

from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401 - register relationship targets
import app.models.organization_avito_integration  # noqa: F401
import app.models.organization_drom_integration  # noqa: F401
from app.models.product import Product
from app.models.stock_out import StockOut
from app.services.stock_sale_fulfillment import (
    FulfillStockOutRequest,
    StockOutSourceKind,
    fulfill_stock_out,
)
from app.utils.internal_code import build_internal_code


class StockSaleFulfillmentTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        self._create_minimal_tables()
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _create_minimal_tables(self):
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

    def _product(self, *, product_id=1, quantity=5):
        product = Product(
            id=product_id,
            internal_code=build_internal_code(organization_id, product_id),
            article=f"A-{product_id}",
            name="Test part",
            brand="Test",
            price=100,
            quantity=quantity,
            organization_id="org1",
            storage_location_id=1,
            created_by=1,
            part_type_id=1,
        )
        self.db.add(product)
        self.db.commit()
        return product

    def _request(self, **overrides):
        payload = {
            "organization_id": "org1",
            "product_id": 1,
            "quantity": 1,
            "sale_price": 100,
            "storage_location_id": 1,
            "movement_date": date.today(),
            "source_kind": StockOutSourceKind.WAREHOUSE_MANUAL,
            "user_id": 1,
            "acquired_product_id": None,
            "reason": None,
            "sale_channel": "warehouse",
            "avito_order_id": None,
            "garage_used_order_item_id": None,
        }
        payload.update(overrides)
        return FulfillStockOutRequest(**payload)

    def test_manual_fulfill_decrements_qty(self):
        product = self._product(quantity=5)
        result = fulfill_stock_out(self.db, self._request(quantity=2))

        self.assertTrue(result.created)
        self.assertEqual(product.quantity, 3)
        self.assertEqual(self.db.query(StockOut).count(), 1)

    def test_manual_two_sales_allowed(self):
        product = self._product(quantity=5)
        fulfill_stock_out(self.db, self._request(quantity=1))
        fulfill_stock_out(self.db, self._request(quantity=1))

        self.assertEqual(product.quantity, 3)
        self.assertEqual(self.db.query(StockOut).count(), 2)

    def test_avito_fulfill_idempotent(self):
        product = self._product(quantity=5)
        request = self._request(
            source_kind=StockOutSourceKind.AVITO,
            sale_channel="avito",
            avito_order_id="avito-1",
            user_id=None,
        )
        first = fulfill_stock_out(self.db, request)
        second = fulfill_stock_out(self.db, request)

        self.assertTrue(first.created)
        self.assertFalse(second.created)
        self.assertEqual(first.stock_out.id, second.stock_out.id)
        self.assertEqual(product.quantity, 4)
        self.assertEqual(self.db.query(StockOut).count(), 1)

    def test_insufficient_quantity(self):
        self._product(quantity=1)

        with self.assertRaises(HTTPException):
            fulfill_stock_out(self.db, self._request(quantity=2))

    def test_marketplace_used_fulfill_idempotent(self):
        product = self._product(quantity=5)
        request = self._request(
            source_kind=StockOutSourceKind.MARKETPLACE_USED,
            sale_channel="marketplace_used",
            garage_used_order_item_id=101,
            user_id=1,
        )
        first = fulfill_stock_out(self.db, request)
        second = fulfill_stock_out(self.db, request)

        self.assertTrue(first.created)
        self.assertFalse(second.created)
        self.assertEqual(first.stock_out.id, second.stock_out.id)
        self.assertEqual(product.quantity, 4)
        self.assertEqual(self.db.query(StockOut).count(), 1)

    def test_source_kind_mapping_writeoff(self):
        self._product(quantity=3)
        result = fulfill_stock_out(
            self.db,
            self._request(
                sale_price=0,
                sale_channel=None,
                reason="Брак",
                source_kind=StockOutSourceKind.WRITEOFF,
            ),
        )

        self.assertEqual(result.stock_out.source_kind, "writeoff")


if __name__ == "__main__":
    unittest.main()
