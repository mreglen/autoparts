import unittest

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
import app.models.organization_avito_integration  # noqa: F401
import app.models.organization_drom_integration  # noqa: F401
from app.models.product import Product
from app.models.product_storage_cell import ProductStorageCell
from app.services.my_products_query_service import (
    apply_my_products_filters,
    apply_my_products_sort,
)
from app.utils.internal_code import build_internal_code


class MyProductsFiltersTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
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
                    CREATE TABLE product_storage_cells (
                        id INTEGER PRIMARY KEY,
                        product_id INTEGER NOT NULL,
                        storage_cell_id INTEGER NOT NULL,
                        value VARCHAR(50)
                    )
                    """
                )
            )
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.db = self.Session()
        self._add_product(
            product_id=1,
            name="Alpha filter",
            article="A-1",
            price=300,
            storage_location_id=10,
        )
        self._add_product(
            product_id=2,
            name="Beta pump",
            article="B-2",
            price=100,
            storage_location_id=10,
        )
        self._add_product(
            product_id=3,
            name="Gamma pad",
            article="G-3",
            price=200,
            storage_location_id=20,
        )
        self.db.add(
            ProductStorageCell(product_id=1, storage_cell_id=101, value="A-1")
        )
        self.db.add(
            ProductStorageCell(product_id=2, storage_cell_id=102, value="B-2")
        )
        self.db.add(
            ProductStorageCell(product_id=3, storage_cell_id=201, value="1")
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _add_product(self, *, product_id, name, article, price, storage_location_id):
        self.db.add(
            Product(
                id=product_id,
                internal_code=build_internal_code("org1", product_id),
                article=article,
                name=name,
                brand="Brand",
                price=price,
                quantity=5,
                organization_id="org1",
                storage_location_id=storage_location_id,
                created_by=1,
                part_type_id=1,
            )
        )

    def _base_query(self):
        return self.db.query(Product).filter(
            Product.organization_id == "org1",
            Product.quantity > 0,
        )

    def test_storage_cell_filter_returns_only_linked_products(self):
        query = apply_my_products_filters(self._base_query(), None, 101, None, "")
        ids = [row.id for row in query.all()]
        self.assertEqual(ids, [1])

    def test_storage_location_and_cell_filters_combine(self):
        query = apply_my_products_filters(self._base_query(), 10, 102, None, "")
        ids = [row.id for row in query.all()]
        self.assertEqual(ids, [2])

    def test_search_with_cell_filter(self):
        query = apply_my_products_filters(self._base_query(), 10, None, None, "beta")
        ids = [row.id for row in query.all()]
        self.assertEqual(ids, [2])

    def test_ids_query_matches_filtered_products(self):
        filtered_query = apply_my_products_filters(self._base_query(), 10, None, None, "")
        ids = [row.id for row in apply_my_products_sort(filtered_query, "date_desc").all()]
        self.assertEqual(ids, [2, 1])

    def test_price_sort_asc(self):
        query = apply_my_products_filters(self._base_query(), None, None, None, "")
        ids = [
            row.id
            for row in apply_my_products_sort(query, "price_asc").all()
        ]
        self.assertEqual(ids, [2, 3, 1])

    def test_price_sort_desc(self):
        query = apply_my_products_filters(self._base_query(), None, None, None, "")
        ids = [
            row.id
            for row in apply_my_products_sort(query, "price_desc").all()
        ]
        self.assertEqual(ids, [1, 3, 2])


    def test_storage_cell_value_filter(self):
        query = apply_my_products_filters(self._base_query(), None, 101, "A-1", "")
        ids = [row.id for row in query.all()]
        self.assertEqual(ids, [1])

    def test_storage_cell_without_value_returns_all_in_cell(self):
        query = apply_my_products_filters(self._base_query(), None, 101, None, "")
        ids = [row.id for row in query.all()]
        self.assertEqual(ids, [1])

    def test_search_finds_article_without_separators(self):
        self._add_product(
            product_id=4,
            name="Hyphenated article",
            article="130-901",
            price=50,
            storage_location_id=10,
        )
        self.db.commit()
        query = apply_my_products_filters(self._base_query(), None, None, None, "130901")
        ids = [row.id for row in query.all()]
        self.assertEqual(ids, [4])

    def test_search_finds_name_with_hyphenated_fragment(self):
        self._add_product(
            product_id=5,
            name="Filter 130-901 OEM",
            article="ZZ-1",
            price=60,
            storage_location_id=10,
        )
        self.db.commit()
        query = apply_my_products_filters(self._base_query(), None, None, None, "130901")
        ids = [row.id for row in query.all()]
        self.assertEqual(ids, [5])


if __name__ == "__main__":
    unittest.main()
