import unittest

from app.schemas.product_draft import StorageCellDraftItem
from app.services.product_draft_service import dump_storage_cells, parse_storage_cells


class PendingProductStorageCellServiceTests(unittest.TestCase):
    def test_dump_and_parse_storage_cells_roundtrip(self):
        raw = dump_storage_cells([StorageCellDraftItem(storage_cell_id=7, value="B-3")])
        parsed = parse_storage_cells(raw)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0]["storage_cell_id"], 7)
        self.assertEqual(parsed[0]["value"], "B-3")


if __name__ == "__main__":
    unittest.main()
