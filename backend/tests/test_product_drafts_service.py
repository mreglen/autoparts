import unittest
from unittest.mock import MagicMock

from fastapi import HTTPException

from app.schemas.product_draft import ProductDraftCreate, ProductDraftUpdate, StorageCellDraftItem
from app.services.product_draft_service import (
    apply_draft_payload,
    draft_has_content,
    dump_storage_cells,
    get_owned_draft,
    serialize_draft,
)


class ProductDraftHelpersTests(unittest.TestCase):
    def test_draft_has_content_with_article(self):
        from app.schemas.product_draft import ProductDraftCreate

        self.assertTrue(draft_has_content(ProductDraftCreate(article="ABC123")))

    def test_draft_empty(self):
        from app.schemas.product_draft import ProductDraftCreate

        self.assertFalse(draft_has_content(ProductDraftCreate()))

    def test_get_owned_draft_not_found(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        user = MagicMock(id=1, organization_id="ORG1")

        with self.assertRaises(HTTPException) as ctx:
            get_owned_draft(db, 99, user)
        self.assertEqual(ctx.exception.status_code, 404)

    def test_serialize_draft_parses_json(self):
        draft = MagicMock(
            id=1,
            organization_id="ORG1",
            created_by=5,
            created_at="2026-01-01",
            updated_at="2026-01-02",
            article="A1",
            name="Filter",
            brand="MANN",
            description="desc",
            is_new=True,
            price=100,
            quantity=2,
            storage_location_id=3,
            part_type_id=4,
            photos='["/temp/ORG1/photo.webp"]',
            videos='[]',
            vehicle_ids='[10]',
            storage_cells_json='[{"storage_cell_id": 7, "value": "2"}]',
            creator_name="User U.",
        )
        data = serialize_draft(draft)
        self.assertEqual(data["photos"], ["/temp/ORG1/photo.webp"])
        self.assertEqual(data["vehicle_ids"], [10])
        self.assertEqual(data["storage_cells"][0]["storage_cell_id"], 7)

    def test_dump_storage_cells_accepts_model_dump_dicts(self):
        cells = ProductDraftUpdate(
            storage_cells=[StorageCellDraftItem(storage_cell_id=7, value="2")],
        ).model_dump(exclude_unset=True)["storage_cells"]
        raw = dump_storage_cells(cells)
        self.assertIn('"storage_cell_id": 7', raw)
        self.assertIn('"value": "2"', raw)

    def test_apply_draft_payload_persists_storage_cells(self):
        draft = MagicMock(storage_cells_json=None)
        payload = ProductDraftUpdate(
            article="A1",
            storage_location_id=3,
            storage_cells=[StorageCellDraftItem(storage_cell_id=7, value="2")],
        )
        apply_draft_payload(draft, payload)
        self.assertEqual(draft.article, "A1")
        self.assertEqual(draft.storage_location_id, 3)
        self.assertIn('"storage_cell_id": 7', draft.storage_cells_json)


if __name__ == "__main__":
    unittest.main()
