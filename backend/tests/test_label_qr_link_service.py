import unittest
from unittest.mock import MagicMock, patch

from app.services.label_qr_link_service import upsert_label_qr_link


class LabelQrLinkServiceTests(unittest.TestCase):
    def test_upsert_creates_when_missing(self):
        db = MagicMock()
        empty = MagicMock()
        empty.filter.return_value = empty
        empty.first.return_value = None
        empty.order_by.return_value = empty
        db.query.return_value = empty

        link = upsert_label_qr_link(
            db,
            organization_id='ORG1',
            internal_code='TVGP-AABBP',
            pending_product_id=718,
        )
        self.assertIsNotNone(link)
        db.add.assert_called()
        self.assertEqual(link.pending_product_id, 718)
        self.assertEqual(link.internal_code, 'TVGP-AABBP')

    def test_upsert_updates_product_on_existing_pending(self):
        db = MagicMock()
        existing = MagicMock()
        existing.pending_product_id = 718
        existing.product_id = None
        existing.internal_code = 'TVGP-AABBP'
        existing.organization_id = 'ORG1'

        q = MagicMock()
        q.filter.return_value = q
        q.first.return_value = existing
        q.order_by.return_value = q
        db.query.return_value = q

        link = upsert_label_qr_link(
            db,
            organization_id='ORG1',
            internal_code='TVGP-AABBP',
            pending_product_id=718,
            product_id=55,
        )
        self.assertIs(link, existing)
        self.assertEqual(existing.product_id, 55)
        db.add.assert_not_called()


if __name__ == '__main__':
    unittest.main()
