import unittest
from unittest.mock import MagicMock

from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
import app.models.organization_avito_integration  # noqa: F401
import app.models.organization_drom_integration  # noqa: F401

from app.models.permission import Permission
from app.models.product import Product as ProductModel
from app.models.user import User as UserModel
from app.models.user_permission import UserPermission
from app.routers.products import read_qr_part_card
from app.utils.org_product_access import (
    user_can_access_org_product,
    user_can_access_qr_part_card,
    user_can_create_stock_in,
    user_has_any_permission,
)


class OrgProductAccessTests(unittest.TestCase):
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
                    CREATE TABLE permissions (
                        id INTEGER PRIMARY KEY,
                        code VARCHAR(50) UNIQUE,
                        name VARCHAR(100)
                    )
                    """
                )
            )
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
                    CREATE TABLE user_permissions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER,
                        permission_id INTEGER
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
                        created_by INTEGER NOT NULL DEFAULT 1,
                        part_type_id INTEGER NOT NULL DEFAULT 1
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE product_photos (
                        id INTEGER PRIMARY KEY,
                        product_id INTEGER,
                        photo_url TEXT,
                        thumb_url TEXT,
                        organization_id VARCHAR(10),
                        processing_status VARCHAR(20)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE product_videos (
                        id INTEGER PRIMARY KEY,
                        product_id INTEGER,
                        video_url TEXT,
                        organization_id VARCHAR(10),
                        processing_status VARCHAR(20),
                        created_at DATETIME,
                        updated_at DATETIME
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE storage_cells (
                        id INTEGER PRIMARY KEY,
                        name VARCHAR(255),
                        description TEXT,
                        storage_location_id INTEGER
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE product_storage_cells (
                        id INTEGER PRIMARY KEY,
                        product_id INTEGER,
                        storage_cell_id INTEGER,
                        value VARCHAR(255)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE storage_locations (
                        id INTEGER PRIMARY KEY,
                        address VARCHAR(255),
                        organization_id VARCHAR(10)
                    )
                    """
                )
            )

    def _seed(self):
        stock_in = Permission(id=1, code="stock-in", name="Поступление")
        stock_out = Permission(id=2, code="stock-out", name="Расход")
        self.seller = UserModel(
            id=1,
            public_code="S10000001",
            email="seller@test.ru",
            is_seller=True,
            organization_id="ORG1",
        )
        self.employee_ok = UserModel(
            id=2,
            public_code="E10000002",
            email="emp@test.ru",
            is_employee=True,
            organization_id="ORG1",
        )
        self.employee_denied = UserModel(
            id=3,
            public_code="E10000003",
            email="emp2@test.ru",
            is_employee=True,
            organization_id="ORG1",
        )
        self.other_seller = UserModel(
            id=4,
            public_code="S10000004",
            email="other@test.ru",
            is_seller=True,
            organization_id="ORG2",
        )
        self.product = ProductModel(
            id=10,
            article="A1",
            name="Filter",
            brand="BOSCH",
            internal_code="INT-10",
            is_new=False,
            quantity=2,
            organization_id="ORG1",
            created_by=1,
            part_type_id=1,
        )
        self.db.add_all(
            [
                stock_in,
                stock_out,
                self.seller,
                self.employee_ok,
                self.employee_denied,
                self.other_seller,
                self.product,
            ]
        )
        self.db.add(UserPermission(user_id=2, permission_id=1))
        self.db.commit()

    def test_seller_can_access_qr_card(self):
        self.assertTrue(user_can_access_qr_part_card(self.db, self.seller))

    def test_employee_with_stock_in_can_access_qr_card(self):
        self.assertTrue(user_can_access_qr_part_card(self.db, self.employee_ok))

    def test_employee_without_permission_denied(self):
        self.assertFalse(user_can_access_qr_part_card(self.db, self.employee_denied))

    def test_seller_can_create_stock_in(self):
        self.assertTrue(user_can_create_stock_in(self.db, self.seller))

    def test_employee_with_stock_in_can_create(self):
        self.assertTrue(user_can_create_stock_in(self.db, self.employee_ok))

    def test_employee_without_stock_in_cannot_create(self):
        self.assertFalse(user_can_create_stock_in(self.db, self.employee_denied))

    def test_user_has_any_permission_for_employee(self):
        self.assertTrue(user_has_any_permission(self.db, self.employee_ok, ("stock-in",)))
        self.assertFalse(user_has_any_permission(self.db, self.employee_denied, ("stock-in",)))

    def test_guest_user_denied(self):
        guest = MagicMock(organization_id=None, is_seller=False, is_admin=False, is_employee=False)
        self.assertFalse(user_can_access_qr_part_card(self.db, guest))

    def test_seller_can_access_own_org_product(self):
        self.assertTrue(user_can_access_org_product(self.seller, self.product))

    def test_other_seller_cannot_access_product(self):
        self.assertFalse(user_can_access_org_product(self.other_seller, self.product))

    def test_seller_own_org_returns_card(self):
        result = read_qr_part_card(product_id=10, db=self.db, current_user=self.seller)
        self.assertEqual(result.id, 10)
        self.assertEqual(result.name, "Filter")

    def test_employee_with_stock_in_returns_card(self):
        result = read_qr_part_card(product_id=10, db=self.db, current_user=self.employee_ok)
        self.assertEqual(result.id, 10)

    def test_employee_without_permission_returns_404(self):
        with self.assertRaises(HTTPException) as ctx:
            read_qr_part_card(product_id=10, db=self.db, current_user=self.employee_denied)
        self.assertEqual(ctx.exception.status_code, 404)

    def test_seller_other_org_returns_404(self):
        with self.assertRaises(HTTPException) as ctx:
            read_qr_part_card(product_id=10, db=self.db, current_user=self.other_seller)
        self.assertEqual(ctx.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
