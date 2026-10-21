import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base
from app.models.organization import Organization
from app.models.organization_drom_autoload_cache import OrganizationDromAutoloadCache
from app.models.organization_drom_integration import OrganizationDromIntegration
from app.models.product import Product, ProductPhoto
from app.models.product_drom_listing_link import ProductDromListingLink
from app.services import drom_price_list
from app.services.drom_autoload_xlsx import (
    parse_and_validate_drom_autoload,
    upsert_products_to_drom_autoload,
)

ARTICLES = {
    "AAA": 5,
    "BBB": 3,
    "CCC": 1,
}


def _export_row(article: str, quantity: int) -> dict:
    return {
        "article": article,
        "name": f"Товар {article}",
        "is_new": True,
        "brand": "Bosch",
        "price": 100,
        "quantity": quantity,
        "photos": [],
        "storage_address": "ул. Тестовая, 1",
        "note": "",
    }


class DromPriceListReconcileTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            bind=self.engine,
            tables=[
                Organization.__table__,
                Product.__table__,
                ProductPhoto.__table__,
                ProductDromListingLink.__table__,
                OrganizationDromAutoloadCache.__table__,
                OrganizationDromIntegration.__table__,
            ],
        )
        self.db = sessionmaker(bind=self.engine)()
        self.db.add(Organization(id="ORG1", name="Тест"))
        for index, (article, quantity) in enumerate(ARTICLES.items(), start=1):
            product = Product(
                id=index,
                article=article,
                name=f"Товар {article}",
                brand="Bosch",
                internal_code=f"INT-{article}",
                description="",
                is_new=True,
                price=100,
                quantity=quantity,
                organization_id="ORG1",
                created_by=1,
                part_type_id=1,
            )
            self.db.add(product)
            self.db.add(
                ProductDromListingLink(
                    organization_id="ORG1",
                    product_id=product.id,
                    drom_status="exported",
                )
            )
        self.db.commit()

        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        uploads = root / "uploads" / "drom"
        (uploads / "ORG1").mkdir(parents=True)
        self.xlsx_path = uploads / "ORG1" / "export.xlsx"
        self.xlsx_path.write_bytes(
            upsert_products_to_drom_autoload(None, [_export_row(a, q) for a, q in ARTICLES.items()])
        )
        self.patches = [
            mock.patch.object(drom_price_list, "PROJECT_ROOT", root),
            mock.patch.object(drom_price_list, "DROM_UPLOADS_DIR", uploads),
        ]
        for patcher in self.patches:
            patcher.start()

    def tearDown(self):
        for patcher in self.patches:
            patcher.stop()
        self.db.close()
        self.tmp.cleanup()

    def _file_articles(self):
        parsed = parse_and_validate_drom_autoload(self.xlsx_path.read_bytes())
        return {str(item.get("article")): item for item in parsed.items}

    def _set_quantity(self, article, quantity):
        product = self.db.query(Product).filter(Product.article == article).first()
        product.quantity = quantity
        self.db.commit()

    def test_removes_stocked_out_position(self):
        self._set_quantity("BBB", 0)
        result = drom_price_list.reconcile_drom_price_list(self.db, "ORG1")

        self.assertEqual(result["removed"], 1)
        self.assertEqual(result["removed_articles"], ["BBB"])
        self.assertEqual(set(self._file_articles()), {"AAA", "CCC"})

    def test_refreshes_quantity_of_in_stock_position(self):
        self._set_quantity("AAA", 2)
        drom_price_list.reconcile_drom_price_list(self.db, "ORG1")

        self.assertEqual(int(self._file_articles()["AAA"]["quantity"]), 2)

    def test_returns_position_back_after_stock_return(self):
        self.xlsx_path.write_bytes(
            upsert_products_to_drom_autoload(
                self.xlsx_path.read_bytes(), [_export_row("CCC", 0)], "https://example.test"
            )
        )
        self._set_quantity("CCC", 0)
        drom_price_list.reconcile_drom_price_list(self.db, "ORG1")
        self.assertNotIn("CCC", self._file_articles())

        self._set_quantity("CCC", 4)
        drom_price_list.reconcile_drom_price_list(self.db, "ORG1")
        self.assertEqual(int(self._file_articles()["CCC"]["quantity"]), 4)

    def test_keeps_rows_unknown_to_database(self):
        self.xlsx_path.write_bytes(
            upsert_products_to_drom_autoload(
                self.xlsx_path.read_bytes(), [_export_row("ZZZ", 7)], "https://example.test"
            )
        )
        result = drom_price_list.reconcile_drom_price_list(self.db, "ORG1")

        self.assertIn("ZZZ", self._file_articles())
        self.assertEqual(result["unknown_rows"], 1)
        self.assertEqual(result["removed"], 0)

    def test_removes_most_rows_when_only_one_position_is_in_stock(self):
        self._set_quantity("AAA", 0)
        self._set_quantity("BBB", 0)
        result = drom_price_list.reconcile_drom_price_list(self.db, "ORG1")

        self.assertEqual(result["removed"], 2)
        self.assertEqual(set(self._file_articles()), {"CCC"})

    def test_skips_when_every_row_is_out_of_stock(self):
        for article in ARTICLES:
            self._set_quantity(article, 0)
        result = drom_price_list.reconcile_drom_price_list(self.db, "ORG1")

        self.assertEqual(result["removed"], 0)
        self.assertIn("все позиции", result["skipped"])
        self.assertEqual(set(self._file_articles()), set(ARTICLES))

    def test_no_api_sync_without_auto_sync_flag(self):
        self._set_quantity("BBB", 0)
        with mock.patch.object(drom_price_list, "sync_price_list_chunks_sync") as sync:
            result = drom_price_list.reconcile_drom_price_list(self.db, "ORG1")

        self.assertIsNone(result["sync"])
        sync.assert_not_called()

    def test_matches_articles_ignoring_case_and_spaces(self):
        self._set_quantity("BBB", 0)
        self.xlsx_path.write_bytes(
            upsert_products_to_drom_autoload(
                None,
                [_export_row("AAA", 5), _export_row("bbb", 3), _export_row("CCC", 1)],
            )
        )
        result = drom_price_list.reconcile_drom_price_list(self.db, "ORG1")

        self.assertEqual(result["removed"], 1)
        self.assertEqual(result["removed_articles"], ["bbb"])
        self.assertEqual(set(self._file_articles()), {"AAA", "CCC"})

    def test_renamed_article_row_is_replaced_not_duplicated(self):
        self.xlsx_path.write_bytes(
            upsert_products_to_drom_autoload(
                None,
                [_export_row("aaa", 5), _export_row("bbb", 1), _export_row("ccc", 1)],
            )
        )
        result = drom_price_list.reconcile_drom_price_list(self.db, "ORG1")

        items = self._file_articles()
        self.assertEqual(int(items["BBB"]["quantity"]), 3)
        self.assertNotIn("bbb", items)
        self.assertIn("bbb", result["removed_articles"])

    def test_reconcile_all_covers_orgs_from_database_paths(self):
        self.db.add(Organization(id="ORG2", name="Второй"))
        for index, (article, quantity) in enumerate({"DDD": 0, "EEE": 2}.items(), start=90):
            self.db.add(
                Product(
                    id=index,
                    article=article,
                    name=f"Товар {article}",
                    brand="Bosch",
                    internal_code=f"INT-{article}",
                    description="",
                    is_new=True,
                    price=100,
                    quantity=quantity,
                    organization_id="ORG2",
                    created_by=1,
                    part_type_id=1,
                )
            )
        self.db.commit()

        custom_dir = drom_price_list.PROJECT_ROOT / "custom" / "org2"
        custom_dir.mkdir(parents=True)
        custom_path = custom_dir / "price.xlsx"
        custom_path.write_bytes(
            upsert_products_to_drom_autoload(None, [_export_row("DDD", 1), _export_row("EEE", 1)])
        )
        self.db.add(
            OrganizationDromAutoloadCache(
                organization_id="ORG2",
                saved_path="custom/org2/price.xlsx",
                items_json="[]",
                local_validation_ok=True,
                local_errors_json="[]",
            )
        )
        self.db.commit()

        result = drom_price_list.reconcile_all_drom_price_lists(self.db)

        self.assertEqual({item["organization_id"] for item in result["details"]}, {"ORG1", "ORG2"})
        remaining = parse_and_validate_drom_autoload(custom_path.read_bytes()).items
        self.assertEqual([str(item["article"]) for item in remaining], ["EEE"])

    def test_reconcile_all_walks_price_list_directories(self):
        self._set_quantity("AAA", 0)
        result = drom_price_list.reconcile_all_drom_price_lists(self.db)

        self.assertEqual(result["organizations"], 1)
        self.assertEqual(result["removed"], 1)
        self.assertEqual(set(self._file_articles()), {"BBB", "CCC"})


if __name__ == "__main__":
    unittest.main()
