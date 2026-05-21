import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
import app.models.organization_avito_integration  # noqa: F401
import app.models.organization_drom_integration  # noqa: F401
from app.models.garage_used_orders import GarageUsedOrder, GarageUsedOrderItem
from app.models.product import Product
from app.models.user import User as UserModel
from app.services.marketplace_used_order import (
    UsedOrderDeliveryInput,
    UsedOrderItemInput,
    create_used_orders_from_payload,
)


class MarketplaceUsedOrderTests(unittest.TestCase):
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
                    CREATE TABLE carts (
                        id INTEGER PRIMARY KEY,
                        user_id INTEGER NOT NULL
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE used_parts_cart (
                        id INTEGER PRIMARY KEY,
                        cart_id INTEGER NOT NULL,
                        user_id INTEGER NOT NULL,
                        brand VARCHAR(100),
                        partnumber VARCHAR(100),
                        delivery VARCHAR(255),
                        quantity INTEGER NOT NULL DEFAULT 1,
                        price NUMERIC(12, 2),
                        product_id INTEGER,
                        created_at DATETIME,
                        updated_at DATETIME
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

    def _buyer_without_org(self, user_id=1):
        user = UserModel(
            id=user_id,
            public_code=f"K{100000 + user_id:06d}",
            last_name="Покупатель",
            first_name="Иван",
            email="buyer@test.ru",
            phone="+79001112233",
            hashed_password="x",
            organization_id=None,
        )
        self.db.add(user)
        self.db.commit()
        return user

    def _product(
        self,
        *,
        product_id: int,
        organization_id: str,
        quantity: int = 5,
        price: float = 100.0,
    ):
        product = Product(
            id=product_id,
            internal_code=f"P-{product_id}",
            article=f"A-{product_id}",
            name=f"Part {product_id}",
            brand="Test",
            price=price,
            quantity=quantity,
            organization_id=organization_id,
            storage_location_id=1,
            created_by=1,
            part_type_id=1,
        )
        self.db.add(product)
        self.db.commit()
        return product

    def _delivery(self):
        return UsedOrderDeliveryInput(
            buyer_name="Иван Покупатель",
            buyer_phone="+79001112233",
            buyer_email="buyer@test.ru",
            delivery_type="pickup",
            delivery_address=None,
            transport_company=None,
            pickup_address="г. Москва",
        )

    def _item(self, **kwargs):
        defaults = {
            "name": "Part",
            "brand": "Test",
            "partnumber": "PN1",
            "quantity": 1,
            "price": 100.0,
            "product_id": 1,
        }
        defaults.update(kwargs)
        return UsedOrderItemInput(**defaults)

    def test_buyer_without_org_creates_order_for_seller(self):
        buyer = self._buyer_without_org()
        self._product(product_id=1, organization_id="ORG_SELLER")

        summaries = create_used_orders_from_payload(
            self.db,
            current_user=buyer,
            items=[self._item(product_id=1, price=250.0, quantity=2)],
            delivery=self._delivery(),
            used_cart_item_ids=[],
        )
        self.db.commit()

        self.assertEqual(len(summaries), 1)
        self.assertEqual(summaries[0].organization_id, "ORG_SELLER")
        self.assertEqual(summaries[0].total_amount, 500.0)

        order = self.db.query(GarageUsedOrder).one()
        self.assertEqual(order.organization_id, "ORG_SELLER")
        self.assertEqual(order.buyer_email, "buyer@test.ru")
        item = self.db.query(GarageUsedOrderItem).one()
        self.assertEqual(item.product_id, 1)
        self.assertEqual(item.price, 250.0)

    def test_two_sellers_create_two_orders_with_correct_totals(self):
        buyer = self._buyer_without_org()
        self._product(product_id=1, organization_id="ORG_A", price=100.0)
        self._product(product_id=2, organization_id="ORG_B", price=200.0)

        summaries = create_used_orders_from_payload(
            self.db,
            current_user=buyer,
            items=[
                self._item(product_id=1, price=100.0, quantity=2),
                self._item(product_id=2, price=200.0, quantity=1, name="Part 2"),
            ],
            delivery=self._delivery(),
            used_cart_item_ids=[],
        )
        self.db.commit()

        self.assertEqual(len(summaries), 2)
        totals = {s.organization_id: s.total_amount for s in summaries}
        self.assertEqual(totals["ORG_A"], 200.0)
        self.assertEqual(totals["ORG_B"], 200.0)
        self.assertEqual(self.db.query(GarageUsedOrder).count(), 2)

    def test_insufficient_stock_raises_and_creates_no_orders(self):
        buyer = self._buyer_without_org()
        self._product(product_id=1, organization_id="ORG_A", quantity=1)

        with self.assertRaises(HTTPException) as ctx:
            create_used_orders_from_payload(
                self.db,
                current_user=buyer,
                items=[self._item(product_id=1, quantity=2)],
                delivery=self._delivery(),
                used_cart_item_ids=[],
            )
        self.assertEqual(ctx.exception.status_code, 409)
        self.db.rollback()
        self.assertEqual(self.db.query(GarageUsedOrder).count(), 0)

    def test_missing_product_id_raises_400(self):
        buyer = self._buyer_without_org()
        self._product(product_id=1, organization_id="ORG_A")

        with self.assertRaises(HTTPException) as ctx:
            create_used_orders_from_payload(
                self.db,
                current_user=buyer,
                items=[self._item(product_id=None)],
                delivery=self._delivery(),
                used_cart_item_ids=[],
            )
        self.assertEqual(ctx.exception.status_code, 400)

    def test_duplicate_product_rows_aggregate_stock_check(self):
        buyer = self._buyer_without_org()
        self._product(product_id=1, organization_id="ORG_A", quantity=3)

        with self.assertRaises(HTTPException) as ctx:
            create_used_orders_from_payload(
                self.db,
                current_user=buyer,
                items=[
                    self._item(product_id=1, quantity=2),
                    self._item(product_id=1, quantity=2, name="Part dup"),
                ],
                delivery=self._delivery(),
                used_cart_item_ids=[],
            )
        self.assertEqual(ctx.exception.status_code, 409)
        detail = ctx.exception.detail
        self.assertEqual(detail["requested"], 4)

    def test_foreign_cart_item_ids_raise_403(self):
        buyer = self._buyer_without_org()
        other = UserModel(
            id=2,
            public_code="M384729",
            last_name="Other",
            first_name="User",
            email="other@test.ru",
            phone="+79000000000",
            hashed_password="x",
            organization_id=None,
        )
        self.db.add(other)
        self.db.execute(text("INSERT INTO carts (id, user_id) VALUES (1, 2)"))
        self.db.execute(
            text(
                """
                INSERT INTO used_parts_cart (id, cart_id, user_id, quantity, product_id)
                VALUES (99, 1, 2, 1, NULL)
                """
            )
        )
        self._product(product_id=1, organization_id="ORG_A")
        self.db.commit()

        with self.assertRaises(HTTPException) as ctx:
            create_used_orders_from_payload(
                self.db,
                current_user=buyer,
                items=[self._item(product_id=1)],
                delivery=self._delivery(),
                used_cart_item_ids=[99],
            )
        self.assertEqual(ctx.exception.status_code, 403)

    def test_owned_cart_items_removed_after_order(self):
        buyer = self._buyer_without_org()
        self.db.execute(text("INSERT INTO carts (id, user_id) VALUES (1, 1)"))
        self.db.execute(
            text(
                """
                INSERT INTO used_parts_cart (id, cart_id, user_id, quantity, price, product_id)
                VALUES (10, 1, 1, 1, 100, 1)
                """
            )
        )
        self._product(product_id=1, organization_id="ORG_A")
        self.db.commit()

        create_used_orders_from_payload(
            self.db,
            current_user=buyer,
            items=[self._item(product_id=1)],
            delivery=self._delivery(),
            used_cart_item_ids=[10],
        )
        self.db.commit()

        remaining = self.db.execute(
            text("SELECT COUNT(*) FROM used_parts_cart WHERE id = 10")
        ).scalar()
        self.assertEqual(remaining, 0)


if __name__ == "__main__":
    unittest.main()
