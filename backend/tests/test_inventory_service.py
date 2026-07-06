import unittest
from datetime import date
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
import app.models.organization_avito_integration  # noqa: F401
import app.models.organization_drom_integration  # noqa: F401
import app.models.inventory_session  # noqa: F401
import app.models.inventory_count_line  # noqa: F401
import app.models.inventory_adjustment_line  # noqa: F401
from app.models.inventory_count_line import InventoryCountLine
from app.models.inventory_session import InventorySession
from app.models.product import Product
from app.models.stock_in import StockIn
from app.models.stock_out import StockOut
from app.schemas.inventory import InventorySessionCreate
from app.services.inventory_service import (
    complete_inventory_session,
    create_inventory_session,
    get_inventory_adjustment_report,
    update_inventory_count_line,
)
from app.utils.internal_code import build_internal_code


class _FakeUser:
    id = 1
    organization_id = "ORG1"
    is_seller = True
    is_admin = False
    is_director = False
    is_employee = False


class InventoryServiceTests(unittest.TestCase):
    def setUp(self):
        self.audit_patcher = patch("app.services.inventory_service.log_audit")
        self.audit_patcher.start()
        self.stock_audit_patcher = patch("app.services.stock_sale_fulfillment.log_audit")
        self.stock_audit_patcher.start()
        self.engine = create_engine("sqlite:///:memory:")
        self._create_tables()
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.db = self.Session()
        self.org_id = "ORG1"
        self._seed()

    def tearDown(self):
        self.stock_audit_patcher.stop()
        self.audit_patcher.stop()
        self.db.close()
        self.engine.dispose()

    def _create_tables(self):
        with self.engine.begin() as conn:
            for ddl in (
                """
                CREATE TABLE organizations (
                    id VARCHAR(10) PRIMARY KEY
                )
                """,
                """
                CREATE TABLE storage_locations (
                    id INTEGER PRIMARY KEY,
                    address TEXT,
                    organization_id VARCHAR(10)
                )
                """,
                """
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY,
                    organization_id VARCHAR(10),
                    is_seller BOOLEAN DEFAULT 0,
                    is_admin BOOLEAN DEFAULT 0,
                    is_director BOOLEAN DEFAULT 0,
                    is_employee BOOLEAN DEFAULT 0
                )
                """,
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
                """,
                """
                CREATE TABLE inventory_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    organization_id VARCHAR(10) NOT NULL,
                    storage_location_id INTEGER NOT NULL,
                    status VARCHAR(32) NOT NULL DEFAULT 'draft',
                    scope_type VARCHAR(32) NOT NULL DEFAULT 'location_all',
                    scope_cell_ids_json TEXT,
                    scope_product_ids_json TEXT,
                    title VARCHAR(255),
                    notes TEXT,
                    created_by INTEGER NOT NULL,
                    completed_by INTEGER,
                    started_at DATETIME,
                    completed_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """,
                """
                CREATE TABLE inventory_count_lines (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER NOT NULL,
                    product_id INTEGER NOT NULL,
                    storage_location_id INTEGER NOT NULL,
                    storage_cell_id INTEGER,
                    expected_qty INTEGER NOT NULL DEFAULT 0,
                    counted_qty INTEGER,
                    line_status VARCHAR(32) NOT NULL DEFAULT 'pending',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """,
                """
                CREATE TABLE inventory_adjustment_lines (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER NOT NULL,
                    product_id INTEGER NOT NULL,
                    storage_location_id INTEGER NOT NULL,
                    expected_qty INTEGER NOT NULL DEFAULT 0,
                    counted_qty INTEGER NOT NULL DEFAULT 0,
                    delta_qty INTEGER NOT NULL DEFAULT 0,
                    adjustment_kind VARCHAR(32) NOT NULL,
                    stock_in_id INTEGER,
                    stock_out_id INTEGER,
                    applied_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """,
                """
                CREATE TABLE stock_in (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    quantity INTEGER,
                    sale_price NUMERIC(12, 2),
                    created_at DATE,
                    organization_id VARCHAR,
                    storage_location_id INTEGER,
                    product_id INTEGER,
                    acquired_product_id INTEGER,
                    created_by INTEGER NOT NULL
                )
                """,
                """
                CREATE TABLE stock_out (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
                """,
                """
                CREATE TABLE event_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_type VARCHAR(64),
                    category VARCHAR(32),
                    summary TEXT,
                    details_json TEXT,
                    user_id INTEGER,
                    organization_id VARCHAR(10),
                    entity_type VARCHAR(64),
                    entity_id INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """,
            ):
                conn.execute(text(ddl))

    def _seed(self):
        with self.engine.begin() as conn:
            conn.execute(text("INSERT INTO organizations (id) VALUES ('ORG1')"))
            conn.execute(
                text("INSERT INTO storage_locations (id, address, organization_id) VALUES (1, 'Склад 1', 'ORG1')")
            )
            conn.execute(
                text(
                    "INSERT INTO users (id, organization_id, is_seller) VALUES (1, 'ORG1', 1)"
                )
            )
        for idx, qty in enumerate((10, 5), start=1):
            self.db.add(
                Product(
                    id=idx,
                    article=f"A-{idx}",
                    name=f"Part {idx}",
                    brand="Brand",
                    internal_code=build_internal_code(self.org_id, idx),
                    is_new=True,
                    price=100,
                    quantity=qty,
                    organization_id=self.org_id,
                    storage_location_id=1,
                    created_by=1,
                    part_type_id=1,
                )
            )
        self.db.commit()

    def _user(self):
        return _FakeUser()

    def test_create_session_and_report(self):
        result = create_inventory_session(
            self.db,
            organization_id=self.org_id,
            user=self._user(),
            payload=InventorySessionCreate(storage_location_id=1),
        )
        self.assertEqual(result.lines_total, 2)
        self.assertEqual(result.status, "counting")

        session = self.db.query(InventorySession).first()
        line = self.db.query(InventoryCountLine).filter(InventoryCountLine.session_id == session.id).first()
        update_inventory_count_line(
            self.db,
            organization_id=self.org_id,
            session_id=session.id,
            line_id=line.id,
            counted_qty=12,
            line_status="counted",
        )
        for other in self.db.query(InventoryCountLine).filter(InventoryCountLine.id != line.id):
            update_inventory_count_line(
                self.db,
                organization_id=self.org_id,
                session_id=session.id,
                line_id=other.id,
                counted_qty=other.expected_qty,
                line_status="counted",
            )

        report = get_inventory_adjustment_report(self.db, self.org_id, session.id)
        self.assertTrue(report.can_complete)
        self.assertEqual(report.totals["surplus_count"], 1)

    def test_complete_applies_adjustments(self):
        result = create_inventory_session(
            self.db,
            organization_id=self.org_id,
            user=self._user(),
            payload=InventorySessionCreate(storage_location_id=1),
        )
        session_id = result.id
        lines = self.db.query(InventoryCountLine).filter(InventoryCountLine.session_id == session_id).all()
        for line in lines:
            counted = 12 if line.expected_qty == 10 else 3
            update_inventory_count_line(
                self.db,
                organization_id=self.org_id,
                session_id=session_id,
                line_id=line.id,
                counted_qty=counted,
                line_status="counted",
            )

        complete = complete_inventory_session(
            self.db,
            organization_id=self.org_id,
            user=self._user(),
            session_id=session_id,
            apply_adjustments=True,
        )
        self.assertEqual(complete.status, "completed")
        self.assertEqual(complete.stock_ins_created, 1)
        self.assertEqual(complete.stock_outs_created, 1)

        p1 = self.db.query(Product).filter(Product.id == 1).first()
        p2 = self.db.query(Product).filter(Product.id == 2).first()
        self.assertEqual(p1.quantity, 12)
        self.assertEqual(p2.quantity, 3)
        self.assertEqual(self.db.query(StockIn).count(), 1)
        self.assertEqual(self.db.query(StockOut).count(), 1)

    def test_complete_blocked_with_pending_lines(self):
        result = create_inventory_session(
            self.db,
            organization_id=self.org_id,
            user=self._user(),
            payload=InventorySessionCreate(storage_location_id=1),
        )
        with self.assertRaises(HTTPException):
            complete_inventory_session(
                self.db,
                organization_id=self.org_id,
                user=self._user(),
                session_id=result.id,
                apply_adjustments=True,
            )


if __name__ == "__main__":
    unittest.main()
