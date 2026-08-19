import unittest
from unittest.mock import MagicMock

from app.utils.autoservice_warehouse_supplier import (
    ADMIN_MARKETPLACE_ORG_ID,
    ROSSKO_SUPPLIER_LABEL,
    is_admin_marketplace_rossko_new_order,
    resolve_autoservice_supplier_display_name,
)


class AutoserviceWarehouseSupplierTests(unittest.TestCase):
    def test_admin_new_order_uses_rossko_label(self):
        db = MagicMock()
        order = MagicMock(organization_id=ADMIN_MARKETPLACE_ORG_ID)
        db.query.return_value.filter.return_value.first.return_value = order

        self.assertTrue(
            is_admin_marketplace_rossko_new_order(
                db,
                source_order_type="new",
                source_order_id=6,
            )
        )
        self.assertEqual(
            resolve_autoservice_supplier_display_name(
                db,
                supplier_name="Свой Гараж",
                source_order_type="new",
                source_order_id=6,
            ),
            ROSSKO_SUPPLIER_LABEL,
        )

    def test_other_org_keeps_supplier_name(self):
        db = MagicMock()
        order = MagicMock(organization_id="OTHERORG1")
        db.query.return_value.filter.return_value.first.return_value = order

        self.assertEqual(
            resolve_autoservice_supplier_display_name(
                db,
                supplier_name="Свой Гараж",
                source_order_type="new",
                source_order_id=6,
            ),
            "Свой Гараж",
        )

    def test_used_order_keeps_supplier_name(self):
        db = MagicMock()
        self.assertEqual(
            resolve_autoservice_supplier_display_name(
                db,
                supplier_name="Свой Гараж",
                source_order_type="used",
                source_order_id=4,
            ),
            "Свой Гараж",
        )


if __name__ == "__main__":
    unittest.main()
