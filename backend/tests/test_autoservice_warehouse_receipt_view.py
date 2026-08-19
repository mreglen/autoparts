import unittest
from datetime import date, datetime
from decimal import Decimal
from unittest.mock import MagicMock, patch

from app.routers.autoservice_warehouse import _doc_detail_view, _receipt_line_view


class AutoserviceWarehouseReceiptViewTests(unittest.TestCase):
    def test_receipt_line_view_accepts_pricing_unit_without_duplicate_kwarg(self):
        item = MagicMock()
        item.brand = "Bosch"
        item.article = "0986424791"
        item.name = "Колодки"
        item.unit = "pcs"

        row = MagicMock()
        row.id = 11
        row.item_id = 5
        row.item = item
        row.quantity = 2
        row.unit_price = Decimal("100.00")
        row.cart_item_type = "manual"
        row.cart_item_id = None
        row.repair_order_id = 7
        row.created_at = datetime(2026, 8, 19, 12, 30)
        row.creator = None

        doc = MagicMock()
        doc.supplier_kind = "manual"

        with patch(
            "app.routers.autoservice_warehouse.receipt_line_pricing_context",
            return_value={
                "can_edit_price": True,
                "can_edit_unit": True,
                "unit": "pcs",
                "client_unit_price_override": None,
                "markup_percent": Decimal("5.00"),
                "automatic_client_unit_price": Decimal("105.00"),
            },
        ):
            view = _receipt_line_view(MagicMock(), row, doc)

        self.assertEqual(view.id, 11)
        self.assertEqual(view.unit, "pcs")
        self.assertEqual(view.created_at, date(2026, 8, 19))
        self.assertEqual(view.line_total, Decimal("200.00"))
        self.assertTrue(view.can_edit_price)

    def test_doc_detail_view_serializes_lines(self):
        item = MagicMock()
        item.brand = None
        item.article = None
        item.name = "Масло"
        item.unit = "l"

        line = MagicMock()
        line.id = 1
        line.item_id = 2
        line.item = item
        line.quantity = 1
        line.unit_price = Decimal("12450.00")
        line.cart_item_type = "new"
        line.cart_item_id = 9
        line.repair_order_id = None
        line.created_at = date(2026, 8, 19)
        line.creator = None

        doc = MagicMock()
        doc.id = 1
        doc.number = "П-1"
        doc.doc_date = date(2026, 8, 19)
        doc.supplier_kind = "purchase_new"
        doc.supplier_name = "Rossko"
        doc.repair_order_id = None
        doc.repair_order = None
        doc.creator = None
        doc.created_at = datetime(2026, 8, 19, 10, 0)
        doc.lines = [line]

        view = _doc_detail_view(MagicMock(), doc)
        self.assertEqual(view.id, 1)
        self.assertEqual(view.total_amount, Decimal("12450.00"))
        self.assertEqual(len(view.lines), 1)
        self.assertEqual(view.lines[0].brand, "")
        self.assertEqual(view.lines[0].name, "Масло")
        self.assertEqual(view.lines[0].unit, "l")


if __name__ == "__main__":
    unittest.main()
