import unittest
from datetime import date

from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
import app.models.organization_avito_integration  # noqa: F401
import app.models.organization_drom_integration  # noqa: F401
from app.models.garage_used_orders import GarageUsedOrder, GarageUsedOrderItem
from app.models.product import Product
from app.models.stock_out import StockOut
from app.services.marketplace_used_fulfillment import (
    FULFILLMENT_TRIGGER_STATUS,
    fulfill_used_order_on_status_change,
)


class MarketplaceUsedFulfillmentTests(unittest.TestCase):
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
                    CREATE TABLE garage_used_orders (
                        id INTEGER PRIMARY KEY,
                        organization_id VARCHAR(10) NOT NULL,
                        buyer_name VARCHAR(255) NOT NULL DEFAULT '',
                        buyer_phone VARCHAR(50) NOT NULL DEFAULT '',
                        buyer_email VARCHAR(255) NOT NULL DEFAULT '',
                        delivery_type VARCHAR(50) NOT NULL DEFAULT 'transport',
                        delivery_address TEXT,
                        transport_company VARCHAR(255),
                        pickup_address TEXT,
                        total_amount FLOAT NOT NULL DEFAULT 0.0,
                        is_paid BOOLEAN NOT NULL DEFAULT 0,
                        status_code VARCHAR(50) NOT NULL DEFAULT 'pending',
                        created_at DATETIME,
                        updated_at DATETIME
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE garage_used_order_items (
                        id INTEGER PRIMARY KEY,
                        order_id INTEGER NOT NULL,
                        product_id INTEGER,
                        name VARCHAR(255) NOT NULL DEFAULT '',
                        brand VARCHAR(100),
                        partnumber VARCHAR(100),
                        quantity INTEGER NOT NULL DEFAULT 1,
                        price FLOAT NOT NULL DEFAULT 0.0,
                        status_code VARCHAR(50) NOT NULL DEFAULT 'pending',
                        stock_out_id INTEGER,
                        fulfilled_at DATETIME
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

    def _product(self, *, product_id=1, quantity=5, org="ORG_SELLER"):
        product = Product(
            id=product_id,
            internal_code=f"P-{product_id}",
            article=f"A-{product_id}",
            name="Test part",
            brand="Test",
            price=100,
            quantity=quantity,
            organization_id=org,
            storage_location_id=1,
            created_by=1,
            part_type_id=1,
        )
        self.db.add(product)
        self.db.commit()
        return product

    def _get_product(self, product_id: int) -> Product:
        return self.db.query(Product).filter(Product.id == product_id).one()

    def _order_with_items(self, *, status="pending", items_count=2):
        order = GarageUsedOrder(
            organization_id="ORG_SELLER",
            buyer_name="Buyer",
            buyer_phone="+79001112233",
            buyer_email="b@test.ru",
            delivery_type="pickup",
            total_amount=500.0,
            status_code=status,
        )
        self.db.add(order)
        self.db.flush()
        items = []
        for i in range(items_count):
            item = GarageUsedOrderItem(
                order_id=order.id,
                product_id=i + 1,
                name=f"Part {i + 1}",
                quantity=1,
                price=250.0,
                status_code="pending",
            )
            self.db.add(item)
            items.append(item)
        self.db.commit()
        self.db.refresh(order)
        for item in items:
            self.db.refresh(item)
        order.items = items
        return order

    def test_pending_to_assembled_creates_stock_outs(self):
        self._product(product_id=1, quantity=5)
        self._product(product_id=2, quantity=5)
        order = self._order_with_items()

        summaries = fulfill_used_order_on_status_change(
            self.db,
            order=order,
            new_status_code=FULFILLMENT_TRIGGER_STATUS,
            previous_status_code="pending",
            acting_user_id=10,
        )
        self.db.commit()

        self.assertEqual(len(summaries), 2)
        self.assertTrue(all(s.created for s in summaries))
        self.assertEqual(self.db.query(StockOut).count(), 2)
        items = self.db.query(GarageUsedOrderItem).filter(
            GarageUsedOrderItem.order_id == order.id
        ).all()
        self.assertTrue(all(i.stock_out_id for i in items))
        self.assertTrue(all(i.fulfilled_at for i in items))
        self.assertEqual(self._get_product(1).quantity, 4)
        self.assertEqual(self._get_product(2).quantity, 4)

    def test_repeat_assembled_transition_no_new_stock_outs(self):
        self._product(product_id=1, quantity=5)
        order = self._order_with_items(items_count=1)

        fulfill_used_order_on_status_change(
            self.db,
            order=order,
            new_status_code=FULFILLMENT_TRIGGER_STATUS,
            previous_status_code="pending",
            acting_user_id=10,
        )
        self.db.commit()
        qty_after_first = self._get_product(1).quantity

        summaries = fulfill_used_order_on_status_change(
            self.db,
            order=order,
            new_status_code=FULFILLMENT_TRIGGER_STATUS,
            previous_status_code=FULFILLMENT_TRIGGER_STATUS,
            acting_user_id=10,
        )
        self.db.commit()

        self.assertEqual(summaries, [])
        self.assertEqual(self.db.query(StockOut).count(), 1)
        self.assertEqual(self._get_product(1).quantity, qty_after_first)

    def test_assembled_to_shipped_no_fulfillment(self):
        self._product(product_id=1, quantity=5)
        order = self._order_with_items(items_count=1)
        order.status_code = FULFILLMENT_TRIGGER_STATUS
        for item in order.items:
            item.stock_out_id = 99

        summaries = fulfill_used_order_on_status_change(
            self.db,
            order=order,
            new_status_code="shipped",
            previous_status_code=FULFILLMENT_TRIGGER_STATUS,
            acting_user_id=10,
        )
        self.assertEqual(summaries, [])
        self.assertEqual(self.db.query(StockOut).count(), 0)

    def test_insufficient_stock_raises_409(self):
        self._product(product_id=1, quantity=0)
        order = self._order_with_items(items_count=1)

        with self.assertRaises(HTTPException) as ctx:
            fulfill_used_order_on_status_change(
                self.db,
                order=order,
                new_status_code=FULFILLMENT_TRIGGER_STATUS,
                previous_status_code="pending",
                acting_user_id=10,
            )
        self.db.rollback()
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(self.db.query(StockOut).count(), 0)
        item = self.db.query(GarageUsedOrderItem).filter_by(order_id=order.id).one()
        self.assertIsNone(item.stock_out_id)

    def test_missing_product_id_raises_400(self):
        self._product(product_id=1, quantity=5)
        order = self._order_with_items(items_count=1)
        order.items[0].product_id = None

        with self.assertRaises(HTTPException) as ctx:
            fulfill_used_order_on_status_change(
                self.db,
                order=order,
                new_status_code=FULFILLMENT_TRIGGER_STATUS,
                previous_status_code="pending",
                acting_user_id=10,
            )
        self.assertEqual(ctx.exception.status_code, 400)

    def test_item_with_existing_stock_out_id_skips_recreate(self):
        self._product(product_id=1, quantity=5)
        order = self._order_with_items(items_count=1)
        order.items[0].stock_out_id = 1
        self.db.execute(
            text(
                """
                INSERT INTO stock_out (
                    id, quantity, sale_price, movement_date, organization_id,
                    storage_location_id, product_id, source_kind,
                    garage_used_order_item_id, sale_channel
                ) VALUES (
                    1, 1, 250, :md, 'ORG_SELLER', 1, 1,
                    'marketplace_used', 1, 'marketplace_used'
                )
                """
            ),
            {"md": date.today()},
        )
        self.db.commit()

        summaries = fulfill_used_order_on_status_change(
            self.db,
            order=order,
            new_status_code=FULFILLMENT_TRIGGER_STATUS,
            previous_status_code="pending",
            acting_user_id=10,
        )
        self.assertEqual(len(summaries), 1)
        self.assertFalse(summaries[0].created)
        self.assertEqual(self.db.query(StockOut).count(), 1)


if __name__ == "__main__":
    unittest.main()
