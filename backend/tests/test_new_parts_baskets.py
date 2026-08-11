import unittest

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.models.carts import (
    Cart,
    GuestCart,
    GuestNewPartsBasket,
    GuestNewPartsCart,
    NewPartsBasket,
    NewPartsCart,
)
from app.utils.cart_baskets import (
    create_user_basket,
    get_or_create_default_user_basket,
    load_user_basket_items,
    rename_user_basket,
    resolve_user_basket,
)


class NewPartsBasketTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        self._create_tables()
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.db = self.Session()
        self.cart = Cart(user_id=1)
        self.db.add(self.cart)
        self.db.commit()
        self.db.refresh(self.cart)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _create_tables(self):
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    CREATE TABLE carts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        created_at TIMESTAMP,
                        updated_at TIMESTAMP
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE new_parts_baskets (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        cart_id INTEGER NOT NULL,
                        user_id INTEGER NOT NULL,
                        name VARCHAR(100) NOT NULL,
                        is_default BOOLEAN NOT NULL DEFAULT 0,
                        sort_order INTEGER NOT NULL DEFAULT 0,
                        created_at TIMESTAMP,
                        updated_at TIMESTAMP
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE new_parts_cart (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        cart_id INTEGER NOT NULL,
                        user_id INTEGER NOT NULL,
                        basket_id INTEGER,
                        brand VARCHAR(100) NOT NULL,
                        partnumber VARCHAR(100) NOT NULL,
                        name VARCHAR(255),
                        delivery VARCHAR(255),
                        quantity INTEGER NOT NULL DEFAULT 1,
                        max_quantity INTEGER,
                        price NUMERIC(12, 2) NOT NULL,
                        stock_id VARCHAR(50) NOT NULL,
                        guid VARCHAR(50),
                        delivery_start TIMESTAMP,
                        delivery_end TIMESTAMP,
                        created_at TIMESTAMP,
                        updated_at TIMESTAMP
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE guest_carts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        token_hash VARCHAR(128) NOT NULL UNIQUE,
                        expires_at TIMESTAMP NOT NULL,
                        created_at TIMESTAMP,
                        updated_at TIMESTAMP
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE guest_new_parts_baskets (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        guest_cart_id INTEGER NOT NULL,
                        name VARCHAR(100) NOT NULL,
                        is_default BOOLEAN NOT NULL DEFAULT 0,
                        sort_order INTEGER NOT NULL DEFAULT 0,
                        created_at TIMESTAMP,
                        updated_at TIMESTAMP
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE guest_new_parts_cart (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        guest_cart_id INTEGER NOT NULL,
                        basket_id INTEGER,
                        brand VARCHAR(100) NOT NULL,
                        partnumber VARCHAR(100) NOT NULL,
                        name VARCHAR(255),
                        delivery VARCHAR(255),
                        quantity INTEGER NOT NULL DEFAULT 1,
                        max_quantity INTEGER,
                        price NUMERIC(12, 2) NOT NULL,
                        stock_id VARCHAR(50) NOT NULL,
                        guid VARCHAR(50),
                        delivery_start TIMESTAMP,
                        delivery_end TIMESTAMP,
                        created_at TIMESTAMP,
                        updated_at TIMESTAMP
                    )
                    """
                )
            )

    def test_default_basket_created(self):
        basket = get_or_create_default_user_basket(self.db, self.cart.id, 1)
        self.db.commit()
        self.assertTrue(basket.is_default)
        self.assertEqual(basket.name, "Новые запчасти")

    def test_items_isolated_by_basket(self):
        default_basket = get_or_create_default_user_basket(self.db, self.cart.id, 1)
        project_basket = create_user_basket(self.db, self.cart.id, 1, "Проект Touareg")
        self.db.add(
            NewPartsCart(
                cart_id=self.cart.id,
                user_id=1,
                basket_id=default_basket.id,
                brand="VAG",
                partnumber="111",
                quantity=1,
                price=100,
                stock_id="s1",
            )
        )
        self.db.add(
            NewPartsCart(
                cart_id=self.cart.id,
                user_id=1,
                basket_id=project_basket.id,
                brand="VAG",
                partnumber="111",
                quantity=2,
                price=100,
                stock_id="s1",
            )
        )
        self.db.commit()

        default_items = load_user_basket_items(self.db, self.cart.id, 1, default_basket.id)
        project_items = load_user_basket_items(self.db, self.cart.id, 1, project_basket.id)
        self.assertEqual(len(default_items), 1)
        self.assertEqual(default_items[0].quantity, 1)
        self.assertEqual(len(project_items), 1)
        self.assertEqual(project_items[0].quantity, 2)

    def test_resolve_without_id_returns_default(self):
        default_basket = get_or_create_default_user_basket(self.db, self.cart.id, 1)
        create_user_basket(self.db, self.cart.id, 1, "Другая")
        self.db.commit()
        resolved = resolve_user_basket(self.db, self.cart.id, 1, None)
        self.assertEqual(resolved.id, default_basket.id)

    def test_rename_non_default_basket(self):
        get_or_create_default_user_basket(self.db, self.cart.id, 1)
        custom = create_user_basket(self.db, self.cart.id, 1, "Старый")
        self.db.commit()
        renamed = rename_user_basket(self.db, self.cart.id, 1, custom.id, "Новый")
        self.db.commit()
        self.assertEqual(renamed.name, "Новый")


if __name__ == "__main__":
    unittest.main()
