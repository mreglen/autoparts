import unittest
from unittest.mock import MagicMock, patch

from app.services.label_qr_resolve_service import (
    build_label_qr_path,
    normalize_label_internal_code,
    resolve_approved_product_by_pending_id,
    resolve_label_internal_code,
)


class LabelQrResolveServiceTests(unittest.TestCase):
    def test_normalize_code(self):
        self.assertEqual(normalize_label_internal_code(' tvgp-aabbp '), 'TVGP-AABBP')
        self.assertEqual(normalize_label_internal_code('—'), '')

    def test_build_path(self):
        self.assertEqual(build_label_qr_path('TVGP-AABBP'), '/qr/label/TVGP-AABBP')
        self.assertEqual(build_label_qr_path(''), '')

    def test_resolve_product_includes_organization_id(self):
        db = MagicMock()
        product = MagicMock()
        product.id = 10
        product.organization_id = 'ORG1'
        product.internal_code = 'TVGP-AABBP'
        product.source_pending_id = 718
        q = MagicMock()
        q.filter.return_value = q
        q.first.return_value = product
        db.query.return_value = q

        result = resolve_label_internal_code(db, organization_id='ORG1', internal_code='TVGP-AABBP')
        self.assertEqual(result['type'], 'product')
        self.assertEqual(result['product_id'], 10)
        self.assertEqual(result['organization_id'], 'ORG1')
        self.assertNotIn('path', result)

    @patch('app.services.label_qr_resolve_service._find_product_id_from_approval_audit')
    def test_resolve_pending_via_audit(self, mock_audit):
        db = MagicMock()
        mock_audit.return_value = 55
        product = MagicMock()
        product.id = 55
        product.organization_id = 'ORG1'
        product.internal_code = 'TVGP-AABBP'
        product.source_pending_id = None

        empty_q = MagicMock()
        empty_q.filter.return_value = empty_q
        empty_q.first.return_value = None

        product_q = MagicMock()
        product_q.filter.return_value = product_q
        product_q.first.return_value = product

        def query_side_effect(model):
            if not hasattr(query_side_effect, 'n'):
                query_side_effect.n = 0
            query_side_effect.n += 1
            if query_side_effect.n == 1:
                return empty_q
            return product_q

        db.query.side_effect = query_side_effect

        result = resolve_approved_product_by_pending_id(
            db, organization_id='ORG1', pending_id=718
        )
        self.assertEqual(result['product_id'], 55)
        self.assertEqual(result['organization_id'], 'ORG1')

    @patch('app.services.label_qr_resolve_service._find_internal_code_from_pending_audit')
    @patch('app.services.label_qr_resolve_service._find_product_id_from_approval_audit')
    def test_resolve_pending_via_legacy_internal_code(self, mock_audit, mock_code):
        db = MagicMock()
        mock_audit.return_value = None
        mock_code.return_value = 'TVGP-AABBP'

        product = MagicMock()
        product.id = 99
        product.organization_id = 'ORG1'
        product.internal_code = 'TVGP-AABBP'
        product.source_pending_id = None

        empty_q = MagicMock()
        empty_q.filter.return_value = empty_q
        empty_q.first.return_value = None

        product_q = MagicMock()
        product_q.filter.return_value = product_q
        product_q.first.return_value = product

        def query_side_effect(model):
            if not hasattr(query_side_effect, 'n'):
                query_side_effect.n = 0
            query_side_effect.n += 1
            # 1: source_pending_id miss; later resolve_label_internal_code Product hit
            if query_side_effect.n == 1:
                return empty_q
            return product_q

        db.query.side_effect = query_side_effect

        result = resolve_approved_product_by_pending_id(
            db, organization_id='ORG1', pending_id=718
        )
        self.assertEqual(result['type'], 'product')
        self.assertEqual(result['product_id'], 99)
        self.assertEqual(result['source_pending_id'], 718)


if __name__ == '__main__':
    unittest.main()
